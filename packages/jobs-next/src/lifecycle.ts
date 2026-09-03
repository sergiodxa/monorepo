/**
 * One delivery, start to finish: the log line it opens with, the middleware chain
 * and handler it runs inside a timeout, the monitor ping a completed run sends,
 * and the ack or retry every ending resolves to. Every job reaches the queue
 * through here, whatever triggered it, so one shape covers all of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message } from "@cloudflare/workers-types";
import type { DurationInput } from "@pkg/duration";

import { toMs } from "@pkg/duration";
import { BatchedLogger } from "@pkg/logger";
import { ValidationError } from "@pkg/validate";

import type { AnyJobContext } from "./context";
import type { AnyJobHandler } from "./handler";
import type { AnyJobDefinition } from "./jobs";
import type { AnyJobMiddleware } from "./middleware";

import { JobContext } from "./context";
import { JobTimeout, NonRetriableError, RetryError } from "./errors";
import { ping, UptimeFetchError, UptimeNetworkError } from "./uptime";

/**
 * How long a handler has to give up on its own after its timeout aborts the
 * signal, before the dispatcher settles the delivery for it. Sized to unwind, not
 * to keep working: the choice between acking durable work and letting the
 * message come back is the handler's, and only for as long as it takes to make it.
 */
const SETTLE_GRACE = "5 seconds";

/** What one run needs to happen. */
export interface RunOptions {
	job: AnyJobDefinition;
	/** Resolves the handler, which a malformed message never gets far enough to call. */
	handler: () => Promise<AnyJobHandler>;
	message: Message<unknown>;
	/** The payload, already parsed against the job's schema. */
	input: unknown;
	batchSize: number;
	middleware: readonly AnyJobMiddleware[];
	timeout: DurationInput | undefined;
	uptime: (() => string | undefined) | undefined;
}

/** How the work ended, before the lifecycle decides what that means for the message. */
type Outcome = { status: "done" } | { status: "failed"; error: unknown } | { status: "timeout" };

/**
 * Renders a thrown `cause` that is not an `Error` as log text, serializing an
 * object so its fields reach the log intact instead of collapsing to
 * `[object Object]`, with the serialization guarded against a cause that cycles.
 * @param cause Value found on `error.cause`, of any shape.
 */
function describeCause(cause: unknown): string {
	if (typeof cause !== "object" || cause === null) return String(cause);
	try {
		return JSON.stringify(cause);
	} catch {
		return Object.prototype.toString.call(cause);
	}
}

/** The name and message of a thrown value, whatever it turned out to be. */
function describeError(error: unknown) {
	return {
		name: error instanceof Error ? error.name : "UnknownError",
		message: error instanceof Error ? error.message : String(error),
	};
}

/** Whether a thrown value is this job's timeout, from either the handler or its I/O. */
function isTimeout(error: unknown, signal: AbortSignal): boolean {
	if (error instanceof JobTimeout) return true;
	if (!signal.aborted) return false;
	return error instanceof Error && error.name === "AbortError";
}

/**
 * Runs the middleware chain, ending in the handler.
 * @param chain The dispatcher's middleware, in the order it was declared.
 * @param context The delivery's context, shared by every link.
 * @param handler What runs once the chain reaches its end.
 */
async function runChain(
	chain: readonly AnyJobMiddleware[],
	context: AnyJobContext,
	handler: () => Promise<void>,
): Promise<void> {
	let previous = -1;

	async function dispatch(index: number): Promise<void> {
		if (index <= previous) throw new Error("Job middleware called next() more than once");
		previous = index;

		let middleware = chain[index];
		if (middleware === undefined) return await handler();

		await middleware(context, () => dispatch(index + 1));
	}

	await dispatch(0);
}

/**
 * Waits for the work, and stops waiting a grace period after the timeout aborts it.
 * The handler is not stopped — nothing can stop a promise — so this bounds the wait
 * and cancels the I/O that agreed to be cancelled, which is what the signal is for.
 *
 * @param work Runs the chain and the handler.
 * @param timeout How long the work gets, or `undefined` to wait indefinitely.
 * @param controller Aborted when that time is up.
 */
function waitForWork(
	work: () => Promise<void>,
	timeout: DurationInput | undefined,
	controller: AbortController,
): Promise<Outcome> {
	let finished: Promise<Outcome> = work().then(
		() => ({ status: "done" }) as const,
		(error: unknown) => ({ status: "failed", error }) as const,
	);

	if (timeout === undefined) return finished;

	return new Promise<Outcome>((resolve) => {
		let grace: ReturnType<typeof setTimeout> | undefined;

		let expiry = setTimeout(() => {
			controller.abort(new JobTimeout());
			grace = setTimeout(() => resolve({ status: "timeout" }), toMs(SETTLE_GRACE));
		}, toMs(timeout));

		void finished.then((outcome) => {
			clearTimeout(expiry);
			clearTimeout(grace);
			resolve(outcome);
		});
	});
}

/**
 * Runs one delivery through the whole lifecycle.
 *
 * @param options The job, its handler, and the message to run it for.
 * @throws Whatever the handler threw that is not a retry, a refusal, or a timeout,
 * so the platform retries the invocation as it does today.
 */
export async function runJob(options: RunOptions): Promise<void> {
	let { job, message } = options;
	let logger = new BatchedLogger(`job:${job.name}:${message.id}`);
	let controller = new AbortController();

	let context = new JobContext(job, {
		id: message.id,
		attempts: message.attempts,
		input: options.input,
		batchSize: options.batchSize,
		logger,
		signal: controller.signal,
		message,
	});

	let delivery = { id: message.id, attempts: message.attempts };

	try {
		logger.info("job.started", delivery);

		let outcome = await waitForWork(
			() =>
				runChain(options.middleware, context, async () => {
					let handler = await options.handler();

					if (handler.job !== job) {
						throw new Error(
							`Job "${job.name}" is mapped to a handler written for "${handler.job.name}"`,
						);
					}

					await handler(context);
				}),
			options.timeout,
			controller,
		);

		/**
		 * A run reports a timeout when the dispatcher stopped waiting, when the handler gave up
		 * by throwing, when its I/O was cancelled by the signal, and when the signal aborted
		 * at all — a handler that gave up early has not done the work its monitor watches
		 * for, even when it acked the message on the way out to keep durable work from repeating.
		 */
		let timedOut =
			outcome.status === "timeout" ||
			controller.signal.aborted ||
			(outcome.status === "failed" && isTimeout(outcome.error, controller.signal));

		if (outcome.status === "failed" && !timedOut) {
			return settleFailure(outcome.error, context, logger, delivery);
		}

		if (timedOut) {
			logger.error("job.timed-out", delivery);
			context.retry();
			return;
		}

		if (context.settlement?.type === "retry") {
			logger.error("job.retrying", delivery);
			return;
		}

		try {
			await ping(job.monitorId, options.uptime?.());
		} catch (error) {
			if (error instanceof UptimeFetchError || error instanceof UptimeNetworkError) {
				logger.info("job.uptime-failed", { ...delivery, error: describeError(error) });
				context.ack();
				return;
			}
			throw error;
		}

		context.ack();
		logger.info("job.completed", delivery);
	} finally {
		logger.flush();
	}
}

/**
 * Turns a thrown value into this delivery's ending.
 * @param error What the work threw.
 * @param context The delivery's context, which settles the message.
 * @param logger The job's logger.
 * @param delivery The message id and attempt count every event carries.
 * @throws The error itself when it is none of the three the package classifies.
 */
function settleFailure(
	error: unknown,
	context: AnyJobContext,
	logger: BatchedLogger,
	delivery: { id: string; attempts: number },
): void {
	if (error instanceof RetryError) {
		logger.error("job.retrying", { ...delivery, error: describeError(error) });
		context.retry({ delay: error.delay });
		return;
	}

	if (error instanceof NonRetriableError) {
		logger.error("job.non-retriable", {
			...delivery,
			error: {
				...describeError(error),
				cause:
					error.cause === undefined
						? undefined
						: {
								name: error.cause instanceof Error ? error.cause.name : "UnknownError",
								message:
									error.cause instanceof Error ? error.cause.message : describeCause(error.cause),
								issues: error.cause instanceof ValidationError ? error.cause.issues : undefined,
							},
			},
		});

		context.ack();
		return;
	}

	logger.error("job.failed", { ...delivery, error: describeError(error) });

	throw error;
}

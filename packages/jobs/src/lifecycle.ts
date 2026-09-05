/**
 * One delivery, start to finish: the job log it opens under the batch's, the middleware
 * chain and handler it runs inside a timeout, the monitor ping a completed run sends, and
 * the ack or retry every ending resolves to. Every job reaches the queue through here,
 * whatever triggered it, so one shape covers all of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message } from "@cloudflare/workers-types";
import type { DurationInput } from "@sdxc/duration";
import type { Log } from "@sdxc/logger";

import { toMs, toSeconds } from "@sdxc/duration";
import { ValidationError } from "@sdxc/validate";

import type { AnyJobContext } from "./context.js";
import type { RunnableJobHandler } from "./handler.js";
import type { AnyJobDefinition } from "./jobs.js";
import type { AnyJobMiddleware } from "./middleware.js";

import { JobContext, openJobLog } from "./context.js";
import { Ack, NonRetriable, Retry, Timeout } from "./errors.js";
import { ping, UptimeFetchError, UptimeNetworkError } from "./uptime.js";

/**
 * How long a handler has to end the delivery itself after its timeout aborts the
 * signal, before the dispatcher settles it for them. Sized to unwind, not to keep
 * working: the choice between acking durable work and letting the message come back
 * is the handler's, and only for as long as it takes to make it.
 */
const SETTLE_GRACE = "5 seconds";

/** What one run needs to happen. */
export interface RunOptions {
	job: AnyJobDefinition;
	/** Resolves the handler, which a malformed message never gets far enough to call. */
	handler: () => Promise<RunnableJobHandler>;
	message: Message<unknown>;
	/** The payload, already parsed against the job's schema. */
	input: unknown;
	batchSize: number;
	middleware: readonly AnyJobMiddleware[];
	timeout: DurationInput | undefined;
	uptime: (() => string | undefined) | undefined;
}

/** How the work returned, before its ending is read out of it. */
type Outcome = { status: "done" } | { status: "failed"; error: unknown } | { status: "timeout" };

/**
 * What this delivery ends as. A timeout carries what stopped the run — the ending the
 * handler threw, the cancelled I/O, or the deadline's own `Timeout` — so the record
 * names it.
 */
type Ending =
	| { kind: "done" }
	| { kind: "retry"; delay: DurationInput | undefined; error: Retry }
	| { kind: "refuse"; error: NonRetriable }
	| { kind: "timeout"; ack: boolean; error: unknown }
	| { kind: "failed"; error: unknown };

/**
 * Renders a thrown `cause` that is not an `Error` as log text, serializing an object so
 * its fields reach the log intact instead of collapsing to `[object Object]`, with the
 * serialization guarded against a cause that cycles.
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

/**
 * The cause a job gave up with, as flat fields beside the failure's own. Validation
 * issues ride along serialized, so the record still says which field was wrong.
 * @param cause Value found on `error.cause`, of any shape.
 */
function causeFields(cause: unknown): Log.Fields {
	if (cause === undefined) return {};
	return {
		error: {
			cause_type: cause instanceof Error ? cause.name : "UnknownError",
			cause_message: cause instanceof Error ? cause.message : describeCause(cause),
			cause_issues: cause instanceof ValidationError ? JSON.stringify(cause.issues) : undefined,
		},
	};
}

/** Whether a thrown value is cancelled I/O rather than a failure of its own. */
function isCancelled(error: unknown, signal: AbortSignal): boolean {
	if (!signal.aborted) return false;
	return error instanceof Error && error.name === "AbortError";
}

/**
 * Reads the ending out of how the work returned.
 *
 * An explicit ending is honoured as thrown, with one exception: acking while the signal
 * has aborted settles the message as asked but is still reported as a timeout, since
 * pinging a monitor would claim work that did not finish. Returning normally under an
 * aborted signal is read the same way.
 *
 * @param outcome How the work returned.
 * @param signal This run's signal, aborted with a `Timeout` when its time ran out.
 */
function endingOf(outcome: Outcome, signal: AbortSignal): Ending {
	let deadline: unknown = signal.reason;

	if (outcome.status === "timeout") return { kind: "timeout", ack: false, error: deadline };
	if (outcome.status === "done") {
		return signal.aborted ? { kind: "timeout", ack: false, error: deadline } : { kind: "done" };
	}

	let error = outcome.error;

	if (error instanceof Ack) {
		return signal.aborted ? { kind: "timeout", ack: true, error: deadline } : { kind: "done" };
	}

	if (error instanceof Retry) return { kind: "retry", delay: error.delay, error };
	if (error instanceof NonRetriable) return { kind: "refuse", error };
	if (error instanceof Timeout) return { kind: "timeout", ack: false, error };
	if (isCancelled(error, signal)) return { kind: "timeout", ack: false, error };

	return { kind: "failed", error };
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
 * Waits for the work, and stops waiting a grace period after the timeout aborts it. The
 * handler is not stopped — nothing can stop a promise — so this bounds the wait and
 * cancels the I/O that agreed to be cancelled, which is what the signal is for.
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
			controller.abort(new Timeout());
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
 * Runs one delivery through the whole lifecycle, inside a `job` log that records how it
 * ended and counts that ending into the batch's log.
 *
 * @param options The job, its handler, and the message to run it for.
 * @throws Whatever the handler threw that is none of the four endings, so the platform
 * retries the invocation as it does today.
 */
export async function runJob(options: RunOptions): Promise<void> {
	let { job, message } = options;
	let controller = new AbortController();

	let log = openJobLog({
		job: {
			name: job.name,
			id: message.id,
			attempts: message.attempts,
			batch_size: options.batchSize,
			cron: job.cron,
		},
	});

	let context = new JobContext(job, {
		id: message.id,
		attempts: message.attempts,
		input: options.input,
		batchSize: options.batchSize,
		log,
		signal: controller.signal,
	});

	await log.run(async () => {
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

		await settle(endingOf(outcome, controller.signal), message, log, () =>
			ping(job.monitorId, options.uptime?.()),
		);
	});
}

/**
 * Records the ending on the job's log, counts it into the batch's, and settles the
 * message the way that ending asks. A completed run reports to its monitor first, and a
 * monitor that cannot be reached leaves the run `done`: the work happened.
 *
 * @param ending How the run ended.
 * @param message The delivery to ack or retry.
 * @param log The job's log.
 * @param report Sends the monitor ping.
 * @throws What the handler threw when it was none of the endings, once it is recorded.
 */
async function settle(
	ending: Ending,
	message: Message<unknown>,
	log: Log,
	report: () => Promise<void>,
): Promise<void> {
	if (ending.kind === "retry") {
		let delay = ending.delay === undefined ? undefined : toSeconds(ending.delay);
		log.set({ job: { ending: "retry", delay_s: delay } });
		log.warn("job.retry", { reason: ending.error.message });
		log.parent?.inc("jobs.retried");
		return retry(message, ending.delay);
	}

	if (ending.kind === "refuse") {
		log.set({ job: { ending: "refuse" } });
		log.fail(ending.error, causeFields(ending.error.cause));
		log.parent?.inc("jobs.refused");
		return message.ack();
	}

	if (ending.kind === "timeout") {
		log.set({ job: { ending: "timeout" } });
		log.fail(ending.error);
		log.parent?.inc("jobs.timed_out");
		return ending.ack ? message.ack() : retry(message, undefined);
	}

	if (ending.kind === "failed") {
		log.set({ job: { ending: "failed" } });
		log.fail(ending.error);
		log.parent?.inc("jobs.failed");
		throw ending.error;
	}

	log.set({ job: { ending: "done" } });
	log.parent?.inc("jobs.done");

	try {
		await report();
	} catch (error) {
		if (error instanceof UptimeFetchError || error instanceof UptimeNetworkError) {
			log.warn("job.uptime_failed", { error: error.message });
			message.ack();
			return;
		}
		throw error;
	}

	message.ack();
}

/**
 * Returns the message to the queue, holding it for as long as the job asked.
 * @param message The delivery to retry.
 * @param delay How long to hold it, when a backoff was asked for.
 */
function retry(message: Message<unknown>, delay: DurationInput | undefined): void {
	message.retry(delay === undefined ? {} : { delaySeconds: toSeconds(delay) });
}

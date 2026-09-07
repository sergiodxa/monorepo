/**
 * One delivery, start to finish: the job log it opens under the batch's, the middleware
 * chain and handler it runs inside a timeout, the monitor ping a completed run sends, and
 * the ack or retry every ending resolves to. Every job reaches the queue through here,
 * whatever triggered it, so one shape covers all of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Log } from "@sdxc/logger";

import { toMs, toSeconds } from "@sdxc/duration";
import { ValidationError } from "@sdxc/validate";

import type { AnyJobContext } from "./context.js";
import type { RunnableJobHandler } from "./handler.js";
import type { AnyJobDefinition } from "./jobs.js";
import type { AnyJobMiddleware } from "./middleware.js";
import type { JobDelivery, Settlement } from "./queue.js";

import { JobContext, openJobLog } from "./context.js";
import { Ack, NonRetriable, Retry, Timeout } from "./errors.js";

/**
 * How long a handler has to end the delivery itself after its timeout aborts the
 * signal, before the dispatcher settles it for them. Sized to unwind, not to keep
 * working: the choice between acking durable work and letting the message come back
 * is the handler's, and only for as long as it takes to make it.
 *
 * `onEnd` is bounded by the same span, for the same reason: it runs after the work's
 * deadline has been cleared, so an unbounded report would hold the delivery open.
 */
const SETTLE_GRACE = "5 seconds";

/**
 * What one delivery ended as, for a dispatcher's `onEnd`. A `refuse` is a handler giving
 * up for good; a `timeout` carries whatever stopped the run, which may be the deadline
 * itself or the cancelled I/O it aborted.
 */
export type JobStatus =
	| { type: "done" }
	| { type: "retry"; delay: DurationInput | undefined; error: Retry }
	| { type: "refuse"; error: NonRetriable }
	| { type: "timeout"; error: unknown }
	| { type: "failed"; error: unknown };

/** Runs once a delivery's ending is decided and before it is settled. */
export type OnJobEnd = (context: AnyJobContext, status: JobStatus) => void | Promise<void>;

/** What one run needs to happen. */
export interface RunOptions {
	job: AnyJobDefinition;
	/** Resolves the handler, which a malformed message never gets far enough to call. */
	handler: () => Promise<RunnableJobHandler>;
	delivery: JobDelivery;
	/** The payload, already parsed against the job's schema. */
	input: unknown;
	batchSize: number;
	middleware: readonly AnyJobMiddleware[];
	timeout: DurationInput | undefined;
	onEnd: OnJobEnd | undefined;
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
 * @param options The job, its handler, and the delivery to run it for.
 * @returns What the delivery ended as, for the caller's backend to apply.
 * @throws Whatever the handler threw that is none of the four endings, so the platform
 * retries the invocation as it does today.
 */
export async function runJob(options: RunOptions): Promise<Settlement> {
	let { job, delivery } = options;
	let controller = new AbortController();

	let log = openJobLog({
		job: {
			name: job.name,
			id: delivery.id,
			attempts: delivery.attempts,
			batch_size: options.batchSize,
			cron: job.cron,
		},
	});

	let context = new JobContext(job, {
		id: delivery.id,
		attempts: delivery.attempts,
		input: options.input,
		batchSize: options.batchSize,
		log,
		signal: controller.signal,
	});

	return await log.run(async () => {
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

		return await settle(endingOf(outcome, controller.signal), context, log, options.onEnd);
	});
}

/**
 * Records the ending on the job's log, counts it into the batch's, runs the dispatcher's
 * `onEnd`, and answers with what the delivery ends as. The hook runs after the record is
 * written, so it reads the ending it is being told about, and before the settlement is
 * returned, so work that has to reach a service is finished by then.
 *
 * @param ending How the run ended.
 * @param context The delivery's context, which the hook receives.
 * @param log The job's log.
 * @param onEnd The dispatcher's hook, when it declared one.
 * @returns The settlement the caller's backend applies.
 * @throws What the handler threw when it was none of the endings, once it is recorded.
 */
async function settle(
	ending: Ending,
	context: AnyJobContext,
	log: Log,
	onEnd: OnJobEnd | undefined,
): Promise<Settlement> {
	record(ending, log);

	await report(statusOf(ending), context, log, onEnd);

	if (ending.kind === "failed") throw ending.error;

	return settlementOf(ending);
}

/**
 * The ending as the dispatcher's hook is told about it, without the `ack` a timeout carries
 * for its own settlement.
 * @param ending How the run ended.
 */
function statusOf(ending: Ending): JobStatus {
	if (ending.kind === "retry") return { type: "retry", delay: ending.delay, error: ending.error };
	if (ending.kind === "refuse") return { type: "refuse", error: ending.error };
	if (ending.kind === "timeout") return { type: "timeout", error: ending.error };
	if (ending.kind === "failed") return { type: "failed", error: ending.error };
	return { type: "done" };
}

/**
 * Writes the ending onto the job's log and counts it into the batch's.
 * @param ending How the run ended.
 * @param log The job's log.
 */
function record(ending: Ending, log: Log): void {
	if (ending.kind === "retry") {
		log.set({
			job: {
				ending: "retry",
				delay_s: ending.delay === undefined ? undefined : toSeconds(ending.delay),
			},
		});
		log.warn("job.retry", { reason: ending.error.message });
		log.parent?.inc("jobs.retried");
		return;
	}

	if (ending.kind === "refuse") {
		log.set({ job: { ending: "refuse" } });
		log.fail(ending.error, causeFields(ending.error.cause));
		log.parent?.inc("jobs.refused");
		return;
	}

	if (ending.kind === "timeout") {
		log.set({ job: { ending: "timeout" } });
		log.fail(ending.error);
		log.parent?.inc("jobs.timed_out");
		return;
	}

	if (ending.kind === "failed") {
		log.set({ job: { ending: "failed" } });
		log.fail(ending.error);
		log.parent?.inc("jobs.failed");
		return;
	}

	log.set({ job: { ending: "done" } });
	log.parent?.inc("jobs.done");
}

/** How the delivery is settled, once its ending has been recorded. */
function settlementOf(ending: Ending): Settlement {
	if (ending.kind === "retry") return { type: "retry", delay: ending.delay };
	if (ending.kind === "timeout" && !ending.ack) return { type: "retry", delay: undefined };
	return { type: "ack" };
}

/**
 * Runs the dispatcher's hook, bounded and swallowed. Its failure is never the job's failure:
 * a report that did not land is no reason to redeliver work that did, so anything it throws
 * is recorded on this run's own log and the ending settles as decided.
 *
 * @param status The ending the hook is told about.
 * @param context The delivery's context.
 * @param log The job's log, which a hook failure is recorded on.
 * @param onEnd The hook, when the dispatcher declared one.
 */
async function report(
	status: JobStatus,
	context: AnyJobContext,
	log: Log,
	onEnd: OnJobEnd | undefined,
): Promise<void> {
	if (onEnd === undefined) return;

	let overran: ReturnType<typeof setTimeout> | undefined;

	try {
		await Promise.race([
			Promise.resolve(onEnd(context, status)),
			new Promise<void>((resolve) => {
				overran = setTimeout(() => {
					log.warn("job.hook_overran", { after_s: toSeconds(SETTLE_GRACE) });
					resolve();
				}, toMs(SETTLE_GRACE));
			}),
		]);
	} catch (error) {
		log.warn("job.hook_failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	} finally {
		clearTimeout(overran);
	}
}

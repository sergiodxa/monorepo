/**
 * The four endings a job can throw. Every one of them unwinds the handler, so a job that
 * decides how its delivery ends stops deciding anything else, and the dispatcher settles
 * the message from the class it catches. Thrown by the context's own verbs — `ctx.ack()`,
 * `ctx.retry()`, `ctx.exit()`, `ctx.timeout()` — and grouped under `Job` for the helpers
 * and `instanceof` checks that name them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";

/** Options a retry accepts, adding a backoff to the standard `cause`. */
export interface RetryOptions extends ErrorOptions {
	/**
	 * How long the platform holds the message before redelivering it. A duration rather
	 * than a number of seconds, so milliseconds cannot be passed to a seconds-shaped API
	 * by accident.
	 */
	delay?: DurationInput;
	/** Why this delivery is coming back, for the `job.retrying` event. */
	reason?: string;
}

/**
 * What every ending is. A handler that catches broadly re-throws one of these rather
 * than swallowing its own decision:
 *
 * @example
 * try {
 * 	await charge(invoice);
 * } catch (error) {
 * 	if (error instanceof Ending) throw error;
 * 	ctx.retry({ cause: error });
 * }
 */
export class Ending extends Error {
	override name = "Job.Ending";
}

/**
 * The work is finished: ack the delivery and report a completed run. What returning
 * does, from anywhere in the call stack.
 *
 * @example ctx.ack();
 */
export class Ack extends Ending {
	override name = "Job.Ack";

	constructor(message = "Job finished its work.", options?: ErrorOptions) {
		super(message, options);
	}
}

/**
 * The work did not finish, but a redelivery could: retry the message, optionally after
 * a delay.
 *
 * @example ctx.retry({ delay: "5 minutes" });
 */
export class Retry extends Ending {
	override name = "Job.Retry";

	/** How long to hold the message, when the thrower asked for a backoff. */
	readonly delay: DurationInput | undefined;

	constructor(message = "Job asked to be retried.", options?: RetryOptions) {
		super(message, options);
		this.delay = options?.delay;
	}
}

/**
 * The work cannot succeed: ack the delivery and report the failure, since a redelivery
 * reaches the same result and spending the retries is waste.
 *
 * @example ctx.exit("Team no longer exists", { cause: error });
 */
export class NonRetriable extends Ending {
	override name = "Job.NonRetriable";

	constructor(message = "Job cannot succeed for this message.", options?: ErrorOptions) {
		super(message, options);
	}
}

/**
 * The job ran out of time: retry the message, and report a run that never finished so
 * no monitor is told it did.
 *
 * @example if (ctx.signal.aborted) ctx.timeout();
 */
export class Timeout extends Ending {
	override name = "Job.Timeout";

	constructor(message = "Job ran out of time.", options?: ErrorOptions) {
		super(message, options);
	}
}

/**
 * The endings, under one name to catch and construct them by. `@sdxc/jobs/errors`
 * exports each of them on its own, which is what a type position needs — `Job.Retry`
 * names a value.
 *
 * @example if (error instanceof Job.Retry) hold(error.delay);
 */
export const Job = Object.assign({}, { Ending, Ack, Retry, NonRetriable, Timeout });

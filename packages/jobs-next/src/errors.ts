/**
 * The outcomes a handler throws to end its delivery: retry it, refuse it, or
 * give up because the timeout fired. The router classifies by these classes, so
 * throwing one is how a handler decides what happens to the message it was given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

/** Options a retry accepts, adding a backoff to the standard `cause`. */
export interface RetryOptions extends ErrorOptions {
	/**
	 * How long the platform holds the message before redelivering it. A duration
	 * rather than a number of seconds, so milliseconds cannot be passed to a
	 * seconds-shaped API by accident.
	 */
	delay?: DurationInput;
}

/**
 * Throw to have this delivery redelivered, optionally after a delay. The same
 * options `ctx.retry()` takes, so the thrown and the called spelling agree.
 *
 * @example throw new RetryError("Rate limited", { delay: "5 minutes" });
 */
export class RetryError extends Error {
	override name = "RetryError";

	/** How long to hold the message, when the thrower asked for a backoff. */
	readonly delay: DurationInput | undefined;

	constructor(message = "Failed to run job. Retry.", options?: RetryOptions) {
		super(message, options);
		this.delay = options?.delay;
	}
}

/**
 * Throw to ack this delivery without succeeding: a redelivery reaches the same
 * result, so spending the retries is waste.
 *
 * @example throw new NonRetriableError("Invalid input", { cause: result.error });
 */
export class NonRetriableError extends Error {
	override name = "NonRetriableError";

	constructor(message = "Failed to run job. Not retriable.", options?: ErrorOptions) {
		super(message, options);
	}
}

/**
 * Throw when `ctx.signal` has aborted and the handler is giving up. Named to
 * stay clear of the `TimeoutError` DOMException `AbortSignal.timeout()` raises,
 * which a handler may well be catching in the same place.
 *
 * @example if (signal.aborted) throw new JobTimeout();
 */
export class JobTimeout extends Error {
	override name = "JobTimeout";

	constructor(message = "Job gave up: its timeout expired.", options?: ErrorOptions) {
		super(message, options);
	}
}

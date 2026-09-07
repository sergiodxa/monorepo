/**
 * The two plain shapes a backend translates: one delivery as this package sees it, and what a
 * finished run asks be done with that delivery. Keeping both free of platform types is what lets
 * the lifecycle decide an ending without naming whatever is going to apply it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { JSONValue } from "@sdxc/types";

/** Why a message reached the dead-letter queue: it was refused, or its retries ran out. */
export type DeadLetterReason = "invalid_message" | "retries_exhausted";

/** One message, as the backend handed it over. */
export interface JobDelivery {
	id: string;
	/** Which delivery of this message this is, counting from one. */
	attempts: number;
	/** The body as it was written, before the envelope is read out of it. */
	body: unknown;
	enqueuedAt?: Date;
}

/**
 * What one delivery ends as, for the backend to apply. A `retry` carrying no delay asks for
 * whatever backoff that backend applies on its own.
 */
export type Settlement =
	| { type: "ack" }
	| { type: "retry"; delay: DurationInput | undefined }
	| { type: "dead-letter"; reason: DeadLetterReason };

/** Normalized reason a queue call failed. A caller branches on this; the original travels as `cause`. */
export type JobQueueErrorCode =
	/** The backend could not be reached, or refused the operation. */
	| "unavailable"
	/** The backend will not carry a message this shape or this size. */
	| "invalid_message"
	/** The delay asked for is longer than this backend holds a message for. */
	| "unsupported_delay";

/** What a queue states about a failure when it constructs the error. */
export interface JobQueueErrorOptions extends ErrorOptions {
	code: JobQueueErrorCode;
}

/**
 * Failure carried by every queue `Result`, so no backend call throws.
 *
 * `unsupported_delay` is the one worth reading: a backend that silently shortened a delay
 * would turn a job held for three days into one that ran in fifteen minutes.
 */
export class JobQueueError extends Error {
	override name = "JobQueueError";

	readonly code: JobQueueErrorCode;

	/**
	 * @param message What went wrong, for a log or a rethrow.
	 * @param options The code, and the original error as `cause`.
	 */
	constructor(message: string, { code, ...options }: JobQueueErrorOptions) {
		super(message, options);
		this.code = code;
	}
}

/** One message to enqueue: the job it is addressed to, and the payload it carries. */
export interface JobMessage {
	job: string;
	body?: JSONValue;
	/** How long the backend holds it before first delivery. */
	delay?: DurationInput;
}

/** What a pulled backend is asked for when it hands deliveries over. */
export interface ClaimOptions {
	/** Most deliveries to hand over at once. */
	limit: number;
	/** How long the claim holds them before another consumer may take them. */
	lease: DurationInput;
}

/**
 * A queue jobs are enqueued to and delivered from.
 *
 * Nothing here throws: every call answers with a `Result`. `claim` and `settle` are present
 * together on a backend that is pulled, and absent on one that pushes a delivery into the
 * dispatcher itself.
 */
export interface JobQueue {
	/**
	 * Who counts attempts and gives up on a message: the backend's own policy, or this
	 * package's `maxAttempts`. A backend that already has a retry ceiling and a dead-letter
	 * list answers `"backend"`, so nothing here overrules it.
	 */
	readonly retries: "backend" | "core";

	/** Enqueues each message. Enqueuing nothing does nothing. */
	send(messages: JobMessage[]): Promise<Result<void, JobQueueError>>;

	/** Takes deliveries off the queue and leases them to this consumer. */
	claim?(options: ClaimOptions): Promise<Result<JobDelivery[], JobQueueError>>;

	/** Applies what one delivery ended as. */
	settle?(delivery: JobDelivery, settlement: Settlement): Promise<Result<void, JobQueueError>>;
}

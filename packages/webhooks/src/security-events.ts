/**
 * Delivery of Security Event Tokens (RFC 8417) over HTTP: push (RFC 8935), where the
 * transmitter POSTs each SET to the recipient, and poll (RFC 8936), where the recipient
 * fetches pending SETs and acknowledges them, each side with its verification and errors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { JWK, JWT, SecurityEventToken } from "@sdxc/jwt";
import type { Result } from "@sdxc/result";

/** Types for delivering Security Event Tokens. */
export namespace SecurityEvents {
	/**
	 * An RFC 8935 §2.4 error code. The registry is extensible, so a code received from
	 * another party may be one this list does not name.
	 */
	export type ErrorCode =
		| "invalid_request"
		| "invalid_key"
		| "invalid_issuer"
		| "invalid_audience"
		| "authentication_failed"
		| "access_denied"
		| (string & {});

	/** An error as RFC 8935 §2.3 writes it, in a `400` body or a poll's `setErrs`. */
	export interface ErrorBody {
		err: ErrorCode;
		description: string;
	}

	/** A `SecurityEventToken` class, such as a SET profile's subclass, to verify SETs as. */
	export type TokenClass<T extends SecurityEventToken> = (new (payload: JWT.Payload) => T) &
		Pick<typeof SecurityEventToken, "type" | "verify">;

	/** How a recipient verifies the SETs it receives, by push or by poll. */
	export interface VerifyOptions<T extends SecurityEventToken = SecurityEventToken> {
		/**
		 * The issuers SETs are accepted from: each issuer's keys by `iss`, or a lookup that
		 * answers `null` for an issuer it does not accept. A lookup that throws marks the
		 * keys unavailable, so the SET is retried instead of refused.
		 */
		issuers:
			| Record<string, JWK.VerificationKeys>
			| ((issuer: string) => JWK.VerificationKeys | null | Promise<JWK.VerificationKeys | null>);
		/** This recipient's identifiers; a SET must name one of them in `aud`. */
		audience: string | string[];
		/** @default every algorithm `JWT.verify` supports */
		algorithms?: string[];
		/** @default SecurityEventToken */
		token?: TokenClass<T>;
	}

	/** Options for `transmitSet`. */
	export interface TransmitOptions {
		/** Headers to send besides the content negotiation, such as `Authorization`. */
		headers?: HeadersInit;
		signal?: AbortSignal;
	}

	/** An RFC 8936 §2.2 poll request, as the recipient sends it. */
	export interface PollRequest {
		/** The `jti` of every SET received and retained since the last poll. */
		ack?: string[];
		/** The error found in each invalid SET, by `jti`. */
		setErrs?: Record<string, ErrorBody>;
		/** At most this many SETs; `0` acknowledges without receiving any. */
		maxEvents?: number;
		/** Answer at once even with nothing pending, rather than long polling. */
		returnImmediately?: boolean;
	}

	/** Pending SETs by `jti`, and whether more wait beyond them. */
	export interface Batch {
		sets: Record<string, string>;
		moreAvailable: boolean;
	}

	/**
	 * Where a poll transmitter keeps each stream's SETs until the recipient acknowledges
	 * them. A stream is one recipient's feed; the same `jti` in two streams is two entries.
	 * Every method answers a `Result`, and a failure makes the poll endpoint answer `503`.
	 */
	export interface SetStore {
		/** Queues a signed SET for the stream; queuing a `jti` again keeps one entry. */
		add(stream: string, id: string, set: string): Promise<Result<void, Error>>;
		/**
		 * The oldest pending SETs, at most `limit` of them when given, and whether more remain;
		 * a SET stays pending until acknowledged or rejected, so an unacknowledged one returns.
		 */
		pending(stream: string, limit?: number): Promise<Result<Batch, Error>>;
		/** Releases SETs the recipient received; an unknown `jti` is ignored. */
		acknowledge(stream: string, ids: string[]): Promise<Result<void, Error>>;
		/** Releases SETs the recipient found invalid, recording each error for the issuer. */
		reject(stream: string, errors: Record<string, ErrorBody>): Promise<Result<void, Error>>;
	}

	/** Options for `answerPoll`. */
	export interface AnswerPollOptions {
		store: SetStore;
		/** The stream this recipient polls, identified by the caller's own authentication. */
		stream: string;
		/** How long a long poll waits for a SET before answering empty. @default "30 seconds" */
		timeout?: DurationInput;
		/** How often a long poll looks for new SETs. @default "1 second" */
		interval?: DurationInput;
	}

	/** Options for `pollSets`. */
	export interface PollOptions {
		/** Headers to send besides the content negotiation, such as `Authorization`. */
		headers?: HeadersInit;
		signal?: AbortSignal;
	}

	/** What `verifyPolledSets` makes of a batch, ready to persist and acknowledge. */
	export interface PolledSets<T extends SecurityEventToken = SecurityEventToken> {
		/** The verified SETs, to retain before acknowledging them. */
		events: T[];
		/** The `jti` of every verified SET, for the next poll's `ack`. */
		ack: string[];
		/** The error of every invalid SET, for the next poll's `setErrs`. */
		setErrs: Record<string, ErrorBody>;
	}
}

export {
	KeysUnavailableError,
	SecurityEventError,
	TransmissionError,
} from "./lib/security-events/errors.js";
export { MemorySetStore } from "./lib/security-events/memory-store.js";
export { answerPoll, pollSets, verifyPolledSets } from "./lib/security-events/poll.js";
export {
	SecurityEventKey,
	setAccepted,
	setReceiver,
	setRejected,
	transmitSet,
	verifySetRequest,
} from "./lib/security-events/push.js";
export { SET_MEDIA_TYPE, verifySet } from "./lib/security-events/verify.js";

/**
 * Error values every failing signing or verification step returns.
 *
 * All of them extend `WebhookError`, so one `instanceof` check covers the package
 * while the subclasses let a caller answer `401` for an authentication failure and
 * `400` for a body it cannot parse. No message ever carries a secret or a
 * signature, because these values are what gets logged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

/**
 * Base class for every failure this package returns inside a `Result`. Read
 * `name` as the failure kind and `deliveryId` as the delivery it belongs to;
 * the id is `null` until authentication reads the `webhook-id` header.
 *
 * @example
 * if (isFailure(result)) logger.warn("webhook rejected", { kind: result.error.name, id: result.error.deliveryId });
 */
export class WebhookError extends Error {
	override name = "WebhookError";

	/**
	 * Delivery id the failure belongs to, or `null` when the request never
	 * presented one. Set by `verify()` as soon as the header is known, so every
	 * failure after that point is attributable.
	 */
	deliveryId: string | null = null;
}

/**
 * No usable signing secret was configured, so nothing could be verified or
 * signed. Returned for an absent, empty, or non-base64 secret; verification
 * fails closed, and the offending value never reaches the message.
 */
export class InvalidSecretError extends WebhookError {
	override name = "InvalidSecretError";

	/**
	 * @param reason Fixed description of the problem, free of secret material.
	 */
	constructor(reason: string) {
		super(`Invalid signing secret: ${reason}`);
	}
}

/**
 * The delivery handed to `sign()` cannot be turned into a signable message:
 * an empty delivery id, a non-whole-second timestamp, or a payload with no
 * JSON representation — caller mistakes caught before a receiver ever sees it.
 */
export class InvalidDeliveryError extends WebhookError {
	override name = "InvalidDeliveryError";

	/**
	 * @param reason Fixed description of which input was rejected and why.
	 */
	constructor(reason: string) {
		super(`Invalid delivery: ${reason}`);
	}
}

/**
 * The runtime refused to compute the HMAC, so no verdict could be reached.
 * This is an infrastructure failure that says nothing about the delivery's
 * authenticity, so callers must never report it as an authentication failure.
 */
export class SignatureComputationError extends WebhookError {
	override name = "SignatureComputationError";

	/**
	 * @param cause Underlying error from the crypto layer, kept for diagnostics.
	 */
	constructor(cause?: unknown) {
		super("Signature could not be computed", { cause });
	}
}

/**
 * A required signature header is absent from the request.
 *
 * The missing header name is on the error so a misconfigured sender can be told
 * exactly which of the three headers it forgot.
 */
export class MissingHeaderError extends WebhookError {
	override name = "MissingHeaderError";

	/** Name of the header that was expected, lowercase as the specification writes it. */
	readonly header: string;

	/**
	 * @param header Header that was expected but not present.
	 */
	constructor(header: string) {
		super(`Missing ${header} header`);
		this.header = header;
	}
}

/**
 * The `webhook-signature` header carried no signature this package can read:
 * no value used the `v1` scheme, or every `v1` value failed to decode. The
 * header content stays out of the message, since it is signature material.
 */
export class MalformedSignatureError extends WebhookError {
	override name = "MalformedSignatureError";

	constructor() {
		super("No readable v1 signature in the webhook-signature header");
	}
}

/**
 * The `webhook-timestamp` header is not whole seconds since the epoch.
 *
 * Distinct from `StaleTimestampError`: the value never became a time, so it says
 * nothing about how old the delivery is.
 */
export class MalformedTimestampError extends WebhookError {
	override name = "MalformedTimestampError";

	constructor() {
		super("The webhook-timestamp header is not a unix timestamp in seconds");
	}
}

/**
 * The delivery timestamp sits outside the accepted tolerance, in either
 * direction: a captured request replayed later lands here, and so does a
 * sender whose clock runs ahead. Tolerance is the only knob that widens it.
 */
export class StaleTimestampError extends WebhookError {
	override name = "StaleTimestampError";

	/** Time the sender claimed, as read from the header. */
	readonly timestamp: Date;

	/** Accepted skew in milliseconds, applied in both directions. */
	readonly toleranceMs: number;

	/**
	 * @param timestamp Time claimed by the delivery.
	 * @param toleranceMs Accepted skew that the delivery fell outside of.
	 */
	constructor(timestamp: Date, toleranceMs: number) {
		super("The webhook-timestamp header is outside the accepted tolerance");
		this.timestamp = timestamp;
		this.toleranceMs = toleranceMs;
	}
}

/**
 * No presented signature matched any configured secret — the authentication
 * failure. The body, id, timestamp, or secret differs from what the sender
 * used, and the identical message keeps failures from acting as an oracle.
 */
export class SignatureMismatchError extends WebhookError {
	override name = "SignatureMismatchError";

	constructor() {
		super("No signature matched the configured secrets");
	}
}

/**
 * The delivery id has already been seen, so the request is a replay.
 *
 * Only returned when a `ReplayStore` is configured, and only after the signature
 * has verified, so an unauthenticated request can never write to the store.
 */
export class DuplicateDeliveryError extends WebhookError {
	override name = "DuplicateDeliveryError";

	constructor() {
		super("This delivery id has already been processed");
	}
}

/**
 * The replay store could not be read or written, so the delivery is
 * rejected: a delivery that cannot be recorded cannot be de-duplicated, and
 * accepting it would drop replay protection for as long as the store is down.
 */
export class ReplayStoreError extends WebhookError {
	override name = "ReplayStoreError";

	/** Store operation that failed, either `"seen"` or `"remember"`. */
	readonly operation: "seen" | "remember";

	/**
	 * @param operation Store call that threw.
	 * @param cause Error the store threw, kept for diagnostics.
	 */
	constructor(operation: "seen" | "remember", cause?: unknown) {
		super(`The replay store failed during ${operation}`, { cause });
		this.operation = operation;
	}
}

/**
 * The request body could not be read as text, likely because it was already
 * consumed upstream. Verification needs the exact bytes from a stream that
 * can only be read once, so whoever reads it first must verify.
 */
export class UnreadableBodyError extends WebhookError {
	override name = "UnreadableBodyError";

	/**
	 * @param cause Error raised while reading the stream, when there was one.
	 */
	constructor(cause?: unknown) {
		super("The request body has already been read and cannot be verified", { cause });
	}
}

/**
 * The signature verified, but the body is not the shape the caller expected.
 * An unmodelled event type is still a genuine delivery, so the verified
 * `body` and `timestamp` travel on the error to accept, store, or ignore.
 *
 * @example
 * if (result.error instanceof PayloadValidationError) return accepted(); // authentic, just unmodelled
 */
export class PayloadValidationError extends WebhookError {
	override name = "PayloadValidationError";

	/** Exact body text the signature was verified against. */
	readonly body: string;

	/** Time the verified delivery was sent. */
	readonly timestamp: Date;

	/** Schema issues, or a single issue when the body was not JSON at all. */
	readonly issues: StandardSchemaV1.Issue[];

	/**
	 * @param body Verified body text, kept so the caller can inspect or store it.
	 * @param timestamp Send time of the verified delivery.
	 * @param issues Reasons the body was rejected.
	 */
	constructor(body: string, timestamp: Date, issues: readonly StandardSchemaV1.Issue[]) {
		super("The verified payload does not match the expected shape");
		this.body = body;
		this.timestamp = timestamp;
		this.issues = [...issues];
	}
}

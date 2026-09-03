/**
 * Inbound verification: reads the three signature headers, recomputes the MAC
 * over the exact body received, compares it in constant time, and only then
 * parses the payload.
 *
 * Every rejection is a distinct error value, so a caller can answer `401` for an
 * unauthentic request and `400` for an authentic one it cannot model, and the raw
 * body travels back with the result because it is what was actually verified.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Bytes } from "@sdxc/crypto";
import type { DurationInput } from "@sdxc/duration";
import type { Failure, Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { timingSafeEqual } from "@sdxc/crypto";
import { toMs } from "@sdxc/duration";
import { failure, isFailure, success } from "@sdxc/result";
import { validate } from "@sdxc/validate";

import type { WebhookError } from "./errors";
import type { ReplayStore } from "./replay-store";
import type { SecretOptions } from "./secret";

import {
	DuplicateDeliveryError,
	MalformedTimestampError,
	MissingHeaderError,
	PayloadValidationError,
	ReplayStoreError,
	SignatureMismatchError,
	StaleTimestampError,
	UnreadableBodyError,
} from "./errors";
import { ID_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "./headers";
import { resolveSecrets } from "./secret";
import { computeSignature, parseSignatures, signedContent } from "./signature";

/** Accepted clock skew when a caller does not choose one, applied in both directions. */
const DEFAULT_TOLERANCE: DurationInput = "5 minutes";

/** Milliseconds in one second, for turning the header value into a time. */
const SECOND_MS = 1000;

/** How much longer than the tolerance a delivery id stays remembered by default. */
const TTL_TOLERANCE_FACTOR = 2;

/**
 * A timestamp header must be a second count written canonically: digits only,
 * no sign, no padding, and short enough to be a time, so it round-trips into
 * the signed content unchanged, matching what the sender signed.
 */
const TIMESTAMP_PATTERN = /^(?:0|[1-9]\d{0,14})$/;

/**
 * How a caller configures `verify()`.
 *
 * Pass the options inline: the payload type is read off the object literal, so
 * annotating a variable with this interface widens the payload back to `unknown`.
 */
export interface VerifyOptions extends SecretOptions {
	/**
	 * Accepted difference between the delivery timestamp and now, applied in both
	 * directions so a sender's clock may also run ahead. This is the width of the
	 * replay window when no `store` is configured.
	 *
	 * @default "5 minutes"
	 */
	tolerance?: DurationInput;

	/**
	 * Schema the verified body is parsed with. Any Standard Schema works, so a
	 * sender-provided schema needs no adapter. A body that fails it surfaces as
	 * a parsing failure after authentication has already succeeded.
	 */
	schema?: StandardSchemaV1;

	/**
	 * Store consulted to reject a delivery id that was already accepted. Without
	 * one, tolerance alone bounds how long a captured request stays replayable.
	 */
	store?: ReplayStore;

	/**
	 * How long an accepted delivery id is remembered.
	 *
	 * @default twice the tolerance, the longest a replay could still be in-window
	 */
	ttl?: DurationInput;
}

/**
 * A verified delivery.
 *
 * @template Payload Parsed body type; `unknown` unless a `schema` was supplied.
 */
export interface VerifiedDelivery<Payload = unknown> {
	/** Delivery id from `webhook-id`, the value to de-duplicate and log on. */
	id: string;

	/** Send time from `webhook-timestamp`. */
	timestamp: Date;

	/** Exact body text the signature was verified against. */
	body: string;

	/** Parsed body, typed by the schema when one was given. */
	payload: Payload;
}

/**
 * Payload type a `verify()` call resolves to, given the options it was passed.
 *
 * A call with a `schema` gets that schema's output type; a call without one gets
 * `unknown`, so an unvalidated body cannot be read as though it had a shape.
 *
 * @template Options Options object the call was made with.
 */
export type VerifiedPayload<Options> = Options extends {
	schema: infer Schema extends StandardSchemaV1;
}
	? StandardSchemaV1.InferOutput<Schema>
	: unknown;

/**
 * Attaches the delivery id to a failure so a log line can name the delivery.
 *
 * The id is the only request-derived value ever put on an error, keeping the
 * signature and the secret confined to where they were received.
 */
function fail<E extends WebhookError>(error: E, id: string | null): Failure<E> {
	error.deliveryId = id;
	return failure(error);
}

/**
 * A consumed body cannot be verified at all, since the signature covers the
 * exact bytes and a stream is readable only once, so reading an already-used
 * body surfaces as an `UnreadableBodyError`.
 */
async function readBody(request: Request): Promise<Result<string, UnreadableBodyError>> {
	if (request.bodyUsed) return failure(new UnreadableBodyError());

	try {
		return success(await request.text());
	} catch (error) {
		return failure(new UnreadableBodyError(error));
	}
}

/**
 * The body is JSON decoded even without a schema, so a caller always
 * receives a payload, and either failure keeps the verified text on the
 * error, since an authentic but unmodeled delivery is the caller's decision.
 */
async function parsePayload(
	body: string,
	timestamp: Date,
	schema: StandardSchemaV1 | undefined,
): Promise<Result<unknown, PayloadValidationError>> {
	let value: unknown;

	try {
		value = JSON.parse(body);
	} catch {
		return failure(
			new PayloadValidationError(body, timestamp, [{ message: "The body is not valid JSON" }]),
		);
	}

	if (schema === undefined) return success(value);

	let parsed = await validate(value as Record<string, unknown>, schema);
	if (isFailure(parsed)) {
		return failure(new PayloadValidationError(body, timestamp, parsed.error.issues));
	}

	return success(parsed.data);
}

/**
 * Whether any presented MAC matches any configured secret.
 *
 * Every comparison is constant time, so stopping at the first match reveals
 * only which secret of a rotation matched.
 */
async function matchesAnySecret(
	secrets: readonly Bytes[],
	candidates: readonly Bytes[],
	content: string,
): Promise<Result<boolean, WebhookError>> {
	for (let secret of secrets) {
		let expected = await computeSignature(secret, content);
		if (isFailure(expected)) return expected;

		for (let candidate of candidates) {
			if (timingSafeEqual(expected.data, candidate)) return success(true);
		}
	}

	return success(false);
}

/**
 * Verifies a Standard Webhooks request and returns the delivery it carried.
 *
 * A tolerance that resolves to an unusable number collapses to zero, keeping
 * a bypassed type's acceptance window at its narrowest.
 *
 * @param request Inbound request, with its body still unread.
 * @param options Secret or secrets, plus tolerance, schema, and replay store.
 * @returns The verified delivery, or the `WebhookError` describing why it was rejected.
 * @example
 * let result = await Webhooks.verify(request, { secret: env.WEBHOOK_SECRET });
 * if (isFailure(result)) return unauthorized();
 * @example
 * let result = await Webhooks.verify(request, { secrets: [current, previous], schema: EventSchema });
 */
export async function verify<Options extends VerifyOptions>(
	request: Request,
	options: Options,
): Promise<Result<VerifiedDelivery<VerifiedPayload<Options>>, WebhookError>> {
	let secrets = resolveSecrets(options);
	if (isFailure(secrets)) return secrets;

	let id = request.headers.get(ID_HEADER);
	if (id === null || id.length === 0) return failure(new MissingHeaderError(ID_HEADER));

	let timestampHeader = request.headers.get(TIMESTAMP_HEADER);
	if (timestampHeader === null || timestampHeader.length === 0) {
		return fail(new MissingHeaderError(TIMESTAMP_HEADER), id);
	}

	let signatureHeader = request.headers.get(SIGNATURE_HEADER);
	if (signatureHeader === null || signatureHeader.length === 0) {
		return fail(new MissingHeaderError(SIGNATURE_HEADER), id);
	}

	if (!TIMESTAMP_PATTERN.test(timestampHeader)) return fail(new MalformedTimestampError(), id);
	let timestamp = new Date(Number(timestampHeader) * SECOND_MS);

	let configured = toMs(options.tolerance ?? DEFAULT_TOLERANCE);
	let toleranceMs = Number.isFinite(configured) && configured > 0 ? configured : 0;

	if (Math.abs(Date.now() - timestamp.getTime()) > toleranceMs) {
		return fail(new StaleTimestampError(timestamp, toleranceMs), id);
	}

	let candidates = parseSignatures(signatureHeader);
	if (isFailure(candidates)) return fail(candidates.error, id);

	let body = await readBody(request);
	if (isFailure(body)) return fail(body.error, id);

	let content = signedContent(id, Number(timestampHeader), body.data);
	let matched = await matchesAnySecret(secrets.data, candidates.data, content);
	if (isFailure(matched)) return fail(matched.error, id);
	if (!matched.data) return fail(new SignatureMismatchError(), id);

	let store = options.store;
	if (store !== undefined) {
		try {
			if (await store.seen(id)) return fail(new DuplicateDeliveryError(), id);
		} catch (error) {
			return fail(new ReplayStoreError("seen", error), id);
		}
	}

	let payload = await parsePayload(body.data, timestamp, options.schema);
	if (isFailure(payload)) return fail(payload.error, id);

	if (store !== undefined) {
		try {
			await store.remember(id, options.ttl ?? toleranceMs * TTL_TOLERANCE_FACTOR);
		} catch (error) {
			return fail(new ReplayStoreError("remember", error), id);
		}
	}

	return success({
		id,
		timestamp,
		body: body.data,
		payload: payload.data as VerifiedPayload<Options>,
	});
}

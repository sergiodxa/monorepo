/**
 * Outbound signing: turns a payload plus a delivery id and timestamp into the
 * three headers a Standard Webhooks receiver already knows how to verify.
 *
 * The id and the timestamp are parameters instead of being generated here, so a
 * delivery can be re-signed byte for byte in a test or a retry, and the returned
 * body is the exact text that was signed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { WebhookError } from "./errors";

import { InvalidDeliveryError } from "./errors";
import { ID_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER } from "./headers";
import { decodeSecret } from "./secret";
import { computeSignature, formatSignature, signedContent } from "./signature";

/** Milliseconds in one second, the only unit conversion signing needs. */
const SECOND_MS = 1000;

/**
 * What `sign()` needs to produce a verifiable delivery.
 */
export interface SignOptions {
	/**
	 * Signing secret shared with the receiver, base64, with or without the
	 * `whsec_` prefix.
	 */
	secret: string;

	/**
	 * Unique id for this delivery. Receivers de-duplicate on it, so a retry of the
	 * same delivery must reuse it and a new delivery must not.
	 */
	id: string;

	/**
	 * Send time. A number is read as whole seconds since the epoch, matching the
	 * header, so `Date.now()` must be passed as a `Date` instead.
	 */
	timestamp: Date | number;
}

/**
 * A signed delivery, ready to send.
 */
export interface SignedDelivery {
	/**
	 * The three signature headers, freshly constructed and owned by the caller:
	 * mutate freely to add a content type or user agent. Copy it with
	 * `new Headers(...)`; spreading a `Headers` instance yields no entries.
	 */
	headers: Headers;

	/**
	 * Exact body text the signature covers. Send this string; serializing the
	 * payload again may produce different bytes and break verification.
	 */
	body: string;

	/** Delivery id placed in the headers. */
	id: string;

	/** Send time placed in the headers, in whole seconds since the epoch. */
	timestamp: number;

	/** The `webhook-signature` header value, duplicated here for callers that record it. */
	signature: string;
}

/**
 * Converts a caller's timestamp into the whole seconds the header carries.
 *
 * Fractional seconds are floored to match how receivers read the header,
 * so only a valid, whole-second timestamp reaches the signed content.
 */
function toEpochSeconds(timestamp: Date | number): number | null {
	if (timestamp instanceof Date) {
		let ms = timestamp.getTime();
		if (!Number.isFinite(ms) || ms < 0) return null;
		return Math.floor(ms / SECOND_MS);
	}

	if (!Number.isInteger(timestamp) || timestamp < 0) return null;

	return timestamp;
}

/**
 * Turns a payload into the body text to sign, passing strings through
 * untouched since a caller may sign bytes it did not build itself;
 * anything else is JSON encoded once, here, so the signed and sent text match.
 */
function serializeBody(payload: unknown): Result<string, InvalidDeliveryError> {
	if (typeof payload === "string") return success(payload);

	try {
		let body: string | undefined = JSON.stringify(payload);
		if (body === undefined) {
			return failure(new InvalidDeliveryError("the payload has no JSON representation"));
		}
		return success(body);
	} catch {
		return failure(new InvalidDeliveryError("the payload could not be serialized as JSON"));
	}
}

/**
 * Signs a payload and returns the headers and body to deliver.
 *
 * @param payload Body to send: a string is signed as given, anything else is JSON encoded.
 * @param options Secret, delivery id, and send time.
 * @returns The signed delivery, or a `WebhookError` for an unusable secret, id, timestamp, or payload.
 * @example
 * let signed = unwrap(await Webhooks.sign(event, { secret, id: deliveryId, timestamp: new Date() }));
 * signed.headers.set("Content-Type", "application/json");
 * await fetch(endpoint, { method: "POST", headers: signed.headers, body: signed.body });
 */
export async function sign(
	payload: unknown,
	options: SignOptions,
): Promise<Result<SignedDelivery, WebhookError>> {
	let secret = decodeSecret(options.secret);
	if (isFailure(secret)) return secret;

	if (typeof options.id !== "string" || options.id.length === 0) {
		return failure(new InvalidDeliveryError("the delivery id must not be empty"));
	}

	let timestamp = toEpochSeconds(options.timestamp);
	if (timestamp === null) {
		return failure(new InvalidDeliveryError("the timestamp must be whole seconds since the epoch"));
	}

	let body = serializeBody(payload);
	if (isFailure(body)) return body;

	let mac = await computeSignature(secret.data, signedContent(options.id, timestamp, body.data));
	if (isFailure(mac)) return mac;

	let signature = formatSignature(mac.data);

	let headers = new Headers();
	headers.set(ID_HEADER, options.id);
	headers.set(TIMESTAMP_HEADER, String(timestamp));
	headers.set(SIGNATURE_HEADER, signature);

	return success({ headers, body: body.data, id: options.id, timestamp, signature });
}

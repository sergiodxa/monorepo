/**
 * Stripe's own delivery signature: the `Stripe-Signature` header carries a send
 * timestamp and one HMAC-SHA256 per active secret, computed over the timestamp
 * and the exact body joined by a dot. Verification lives here so the endpoint
 * only asks whether a delivery is authentic; the primitives come from
 * `@pkg/crypto`, since this scheme is Stripe's own and not Standard Webhooks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Hex, hmac, timingSafeEqual } from "@pkg/crypto";
import { unwrap } from "@pkg/result";

/** Header a delivery carries its timestamp and MACs in. */
export const SIGNATURE_HEADER = "stripe-signature";

/** Header part holding the send time, in whole seconds since the epoch. */
const TIMESTAMP_PART = "t";

/** Header part holding an HMAC-SHA256 MAC, hex encoded. */
const MAC_PART = "v1";

/** Separator between the parts of the header value. */
const PART_SEPARATOR = ",";

/** How far a delivery's timestamp may be from now before it is refused. */
const DEFAULT_TOLERANCE_SECONDS = 300;

/** Milliseconds in a second, for comparing a header timestamp against the clock. */
const MS_PER_SECOND = 1000;

/** What a `Stripe-Signature` header states, once its parts are read apart. */
export interface StripeSignature {
	/** Send time in whole seconds, which the MAC is computed over. */
	timestamp: number;
	/** Every `v1` MAC in the header, so a delivery sent mid-rotation still verifies. */
	macs: string[];
}

/** What {@link verifyStripeSignature} needs to decide a delivery is authentic. */
export interface VerifyStripeSignatureOptions {
	/** The header value as received. */
	header: string | null;
	/** The body as received, before any parsing. */
	rawBody: string;
	/** Endpoint signing secret, used as the literal text Stripe displays. */
	secret: string;
	/** @default 300 */
	toleranceSeconds?: number;
	/** Clock the timestamp is compared against. @default Date.now() */
	now?: Date;
}

/**
 * Reads a header value into the timestamp and MACs worth comparing against.
 *
 * @param header - The header value as received.
 * @returns The timestamp and its MACs, or `null` when the header states neither.
 *
 * @example
 * parseStripeSignature("t=1614265330,v1=6f3a...");
 */
export function parseStripeSignature(header: string): StripeSignature | null {
	let timestamp: number | null = null;
	let macs: string[] = [];

	for (let part of header.split(PART_SEPARATOR)) {
		let separator = part.indexOf("=");
		if (separator < 0) continue;

		let key = part.slice(0, separator).trim();
		let value = part.slice(separator + 1).trim();

		if (key === TIMESTAMP_PART) timestamp = Number(value);
		if (key === MAC_PART && value.length > 0) macs.push(value);
	}

	if (timestamp === null || !Number.isFinite(timestamp)) return null;
	if (macs.length === 0) return null;

	return { timestamp, macs };
}

/**
 * Builds the exact string a MAC covers: the send timestamp and the body, joined
 * by a dot. The body must be the bytes as received, since two encodings of the
 * same JSON value sign differently.
 *
 * @param timestamp - Send time in whole seconds.
 * @param rawBody - The body as received.
 */
export function signedPayload(timestamp: number, rawBody: string): string {
	return `${timestamp}.${rawBody}`;
}

/**
 * Computes the hex-encoded HMAC-SHA256 a delivery's header is compared against.
 *
 * @param secret - Endpoint signing secret, as its literal text.
 * @param content - Result of {@link signedPayload}.
 */
export async function computeMac(secret: string, content: string): Promise<string> {
	return Hex.encode(unwrap(await hmac.sign(secret, content, { hash: "SHA-256" })));
}

/**
 * Compares two hex MACs in time that depends on their length alone, so a
 * rejection tells an attacker nothing about how much of a forged MAC was right.
 *
 * @param left - First MAC, hex encoded.
 * @param right - Second MAC, hex encoded.
 */
function macsMatch(left: string, right: string): boolean {
	return timingSafeEqual(left, right);
}

/**
 * Answers whether a delivery is authentic, against the exact bytes received.
 * A delivery is authentic only when its timestamp is inside the tolerance and
 * one of its MACs matches, so a captured body cannot be replayed indefinitely.
 *
 * @param options - The header, the raw body, the signing secret, and the clock.
 * @returns `true` only for a delivery this secret proves.
 *
 * @example
 * await verifyStripeSignature({ header, rawBody, secret: "whsec_..." });
 */
export async function verifyStripeSignature(
	options: VerifyStripeSignatureOptions,
): Promise<boolean> {
	if (options.header === null || options.secret.length === 0) return false;

	let signature = parseStripeSignature(options.header);
	if (signature === null) return false;

	let tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
	let now = (options.now ?? new Date()).getTime() / MS_PER_SECOND;
	if (Math.abs(now - signature.timestamp) > tolerance) return false;

	let expected = await computeMac(
		options.secret,
		signedPayload(signature.timestamp, options.rawBody),
	);

	return signature.macs.some((mac) => macsMatch(mac, expected));
}

/**
 * Delivery authentication: the signed manifest Mercado Pago builds from the
 * notification's resource id, the request id, and the timestamp, plus the
 * keyed digest that proves it. The manifest reads the resource id from the
 * notification URL's own query string, so verification covers the URL too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hmac } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";

/** Header carrying the timestamp and the digest, as `ts=<seconds>,v1=<hex>`. */
export const SIGNATURE_HEADER = "x-signature";

/** Header carrying the delivery's request id, which the manifest includes. */
export const REQUEST_ID_HEADER = "x-request-id";

/** Query parameter the notification URL carries the moved resource's id in. */
export const DATA_ID_PARAM = "data.id";

/** Query parameter older notification URLs carry the resource id in. */
export const LEGACY_ID_PARAM = "id";

/** What a delivery presents as proof. */
export interface SignatureParts {
	/** Seconds since the epoch, as the `ts` component spells it. */
	timestamp: string;
	/** The keyed digest, hex encoded, as the `v1` component spells it. */
	digest: string;
}

/** Components a signature header is expected to carry. */
const TIMESTAMP_PART = "ts";

/** Component naming the digest itself, versioned by the platform's scheme. */
const DIGEST_PART = "v1";

/** How many pieces one `key=value` component splits into. */
const COMPONENT_PIECES = 2;

/**
 * Reads the two components out of the signature header.
 *
 * @param header - The header value as received, or `null` when absent.
 * @returns The components, or `null` when either is missing.
 */
export function parseSignature(header: string | null): SignatureParts | null {
	if (header === null) return null;

	let parts = new Map<string, string>();
	for (let part of header.split(",")) {
		let [key, value] = part.split("=", COMPONENT_PIECES);
		if (key !== undefined && value !== undefined) parts.set(key.trim(), value.trim());
	}

	let timestamp = parts.get(TIMESTAMP_PART);
	let digest = parts.get(DIGEST_PART);
	if (timestamp === undefined || digest === undefined) return null;

	return { timestamp, digest };
}

/**
 * Builds the exact string the platform signed. A component the delivery does
 * not carry is left out entirely, key included, which is how the platform
 * builds it for a notification that names no resource or no request.
 *
 * @param parts - The resource id, request id, and timestamp, in that order.
 * @returns The manifest to key the digest over.
 *
 * @example
 * signedManifest({ dataId: "123", requestId: "req-1", timestamp: "1704908010" });
 */
export function signedManifest(parts: {
	dataId: string | null;
	requestId: string | null;
	timestamp: string;
}): string {
	let manifest = "";

	if (parts.dataId !== null) manifest += `id:${parts.dataId};`;
	if (parts.requestId !== null) manifest += `request-id:${parts.requestId};`;
	manifest += `ts:${parts.timestamp};`;

	return manifest;
}

/**
 * Recomputes a manifest's digest under the signing secret and compares it to
 * the one presented, in constant time.
 *
 * @param secret - The application's signing secret, taken from the dashboard.
 * @param manifest - The manifest the platform signed.
 * @param digest - The hex digest the delivery presented.
 * @returns Whether the secret proves this delivery.
 */
export async function verifyManifest(
	secret: string,
	manifest: string,
	digest: string,
): Promise<boolean> {
	let verified = await hmac.verify(secret, manifest, digest.toLowerCase(), { hash: "SHA-256" });

	return isFailure(verified) ? false : verified.data;
}

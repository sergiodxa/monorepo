/**
 * The request fingerprint: what the server compares when a key comes back, so a client
 * that reuses a key for a different payload gets `422` instead of someone else's replay.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { canonicalize } from "@sdxc/json-canonical";
import { isFailure, wrap } from "@sdxc/result";

import { sha256Hex } from "./lib/digest.js";

/** A run of digits longer than a double holds exactly, where two distinct numbers can parse alike. */
const LONG_DIGIT_RUN = /\d{16}/u;

/**
 * SHA-256 over the method, the path with its query, the content type's essence and the
 * body, with a JSON body in its RFC 8785 canonical form so key order and whitespace do not
 * count. The origin and media type parameters do not count either. Pass a clone.
 *
 * @param request - The request, usually `ctx.request.clone()`
 * @returns 64 lowercase hex characters
 * @example await fingerprint(request.clone())
 */
export async function fingerprint(request: Request): Promise<string> {
	let url = new URL(request.url);
	let essence = (request.headers.get("Content-Type") ?? "").split(";")[0]?.trim().toLowerCase();
	let head = new TextEncoder().encode(
		`${JSON.stringify([request.method.toUpperCase(), url.pathname + url.search, essence])}\n`,
	);
	let body = payload(new Uint8Array(await request.arrayBuffer()), essence ?? "");

	let bytes = new Uint8Array(head.byteLength + body.byteLength);
	bytes.set(head, 0);
	bytes.set(body, head.byteLength);
	return await sha256Hex(bytes);
}

/**
 * The bytes a body contributes: the canonical JSON of a `application/json` or `+json` body,
 * so an already-canonical body hashes exactly as sent. Anything that does not parse as
 * I-JSON, or carries a digit run a double would round, contributes its raw bytes.
 */
function payload(body: Uint8Array, essence: string): Uint8Array {
	if (essence !== "application/json" && !essence.endsWith("+json")) return body;
	let text = wrap(() => new TextDecoder("utf-8", { fatal: true }).decode(body));
	if (isFailure(text) || LONG_DIGIT_RUN.test(text.data)) return body;
	let value = wrap((): unknown => JSON.parse(text.data));
	if (isFailure(value)) return body;
	let canonical = canonicalize(value.data);
	if (isFailure(canonical)) return body;
	return new TextEncoder().encode(canonical.data);
}

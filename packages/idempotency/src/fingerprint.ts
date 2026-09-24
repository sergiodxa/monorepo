/**
 * The request fingerprint: what the server compares when a key comes back, so a client
 * that reuses a key for a different payload gets `422` instead of someone else's replay.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { sha256Hex } from "./lib/digest.js";

/**
 * SHA-256 over the method, the path with its query, the content type's essence and the
 * body bytes. The origin is left out because a record is already scoped to one API, and
 * media type parameters are left out because `charset=utf-8` does not change the payload.
 * Reading the body consumes it, so pass a clone of a request something else will read.
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
	let body = new Uint8Array(await request.arrayBuffer());

	let bytes = new Uint8Array(head.byteLength + body.byteLength);
	bytes.set(head, 0);
	bytes.set(body, head.byteLength);
	return await sha256Hex(bytes);
}

/**
 * Converts between a live `Response` and its stored form, and checks a stored form read
 * back from a database, so a replay is byte-identical and a corrupt row is caught.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64 } from "@sdxc/crypto";
import { isSuccess } from "@sdxc/result";

import type { StoredResponse } from "../types.js";

/** Statuses the Fetch standard forbids a body on; rebuilding one of them passes `null`. */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/**
 * Captures a response already read into memory. `Set-Cookie` stays out: a replay may reach
 * a retrying client after the session it names was rotated.
 *
 * @param response - The response whose status and headers are stored
 * @param body - Its body bytes, already buffered
 */
export function toStoredResponse(response: Response, body: Uint8Array): StoredResponse {
	let headers: [string, string][] = [];
	for (let [name, value] of response.headers) {
		if (name !== "set-cookie") headers.push([name, value]);
	}
	return {
		status: response.status,
		headers,
		body: body.byteLength === 0 ? "" : Base64.encode(body),
	};
}

/**
 * Rebuilds the stored response. A body that no longer decodes is replayed empty, which
 * {@link isStoredResponse} rules out for rows a store reads back.
 *
 * @param stored - The stored outcome
 */
export function fromStoredResponse(stored: StoredResponse): Response {
	let decoded = Base64.decode(stored.body);
	let body = NULL_BODY_STATUSES.has(stored.status) || !isSuccess(decoded) ? null : decoded.data;
	return new Response(body, { status: stored.status, headers: stored.headers });
}

/**
 * Rebuilds a response from bytes the middleware buffered, keeping every header it had.
 *
 * @param response - The handler's response, its body already read
 * @param body - The body bytes
 */
export function rebuildResponse(response: Response, body: Uint8Array<ArrayBuffer>): Response {
	return new Response(NULL_BODY_STATUSES.has(response.status) ? null : body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	});
}

/**
 * Checks a value read back from storage has the stored-response shape and a decodable
 * body, so a corrupt row is reported instead of replayed.
 *
 * @param value - The parsed value
 */
export function isStoredResponse(value: unknown): value is StoredResponse {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as Record<string, unknown>;
	if (!Number.isInteger(candidate.status)) return false;
	if (typeof candidate.body !== "string" || !isSuccess(Base64.decode(candidate.body))) return false;
	if (!Array.isArray(candidate.headers)) return false;
	return candidate.headers.every(
		(pair) =>
			Array.isArray(pair) &&
			pair.length === 2 &&
			typeof pair[0] === "string" &&
			typeof pair[1] === "string",
	);
}

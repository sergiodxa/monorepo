/**
 * Client helpers for APIs that honor the Idempotency-Key draft: mint a key once per logical
 * operation and put it on every attempt of it. A key minted per attempt protects nothing,
 * so the helpers keep a key the caller already set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { IdempotencyKeyError } from "./errors.js";

import { formatIdempotencyKey, IDEMPOTENCY_KEY_HEADER } from "./header.js";
import { sha256Parts } from "./lib/digest.js";

/** The methods a key belongs on. */
const KEYED_METHODS = new Set(["POST", "PATCH"]);

/**
 * A random UUID, for a request the caller sends and retries by hand. Mint it before the
 * first attempt and reuse it for every retry.
 *
 * @returns A version 4 UUID
 */
export function generateIdempotencyKey(): string {
	return crypto.randomUUID();
}

/**
 * A stable key derived from the parts with SHA-256, for work retried by a system that
 * remembers its own identity, such as a queue message id that survives redelivery.
 *
 * @param parts - What identifies the operation; boundaries between parts are kept
 * @returns 64 lowercase hex characters
 * @example await deriveIdempotencyKey(ctx.id, "create-monitor")
 */
export function deriveIdempotencyKey(...parts: string[]): Promise<string> {
	return sha256Parts(parts);
}

/**
 * Sets the header on a copy of `init`, keeping every header already there.
 *
 * @param init - The request options
 * @param key - The key for this operation
 * @returns The new options, or why the key cannot be sent
 * @example fetch(url, unwrap(withIdempotencyKey({ method: "POST", body }, key)))
 */
export function withIdempotencyKey(
	init: RequestInit,
	key: string,
): Result<RequestInit, IdempotencyKeyError> {
	let value = formatIdempotencyKey(key);
	if (isFailure(value)) return value;
	let headers = new Headers(init.headers);
	headers.set(IDEMPOTENCY_KEY_HEADER, value.data);
	return success({ ...init, headers });
}

/**
 * Sets the header on a `POST` or `PATCH` that carries none, for an `APIClient` `before`
 * hook. A request that already has a key keeps it, which is how a retrying caller's key
 * survives a hook that runs on every attempt.
 *
 * @param request - The outgoing request
 * @param key - The key to set; a fresh UUID when omitted
 * @returns The request with the header, the request unchanged, or why the key cannot be sent
 */
export function applyIdempotencyKey(
	request: Request,
	key: string = generateIdempotencyKey(),
): Result<Request, IdempotencyKeyError> {
	if (!KEYED_METHODS.has(request.method.toUpperCase())) return success(request);
	if (request.headers.has(IDEMPOTENCY_KEY_HEADER)) return success(request);
	let value = formatIdempotencyKey(key);
	if (isFailure(value)) return value;
	let headers = new Headers(request.headers);
	headers.set(IDEMPOTENCY_KEY_HEADER, value.data);
	return success(new Request(request, { headers }));
}

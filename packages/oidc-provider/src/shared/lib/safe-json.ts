/**
 * Helpers for defensively reading JSON request bodies.
 *
 * Management API controllers accept untrusted JSON, so this module resolves
 * parsing to either the parsed data or a ready `badRequest` `Response`,
 * letting callers branch on the outcome via {@link isResponse}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest } from "@sdxc/http/response/json";

/**
 * Safely parses a JSON object from a request body, resolving to either the
 * parsed object or a ready `badRequest` `Response` for invalid JSON or a
 * non-object top-level value, distinguished via {@link isResponse}.
 * @param request - The incoming request whose body should be parsed as JSON.
 * @returns The parsed object, or a `badRequest` `Response` when parsing fails.
 * @example
 * let body = await safeJsonParse(request);
 * if (isResponse(body)) return body;
 * // body is Record<string, unknown> here
 */
export async function safeJsonParse(request: Request): Promise<Record<string, unknown> | Response> {
	try {
		let body = await request.json();
		if (typeof body !== "object" || body === null || Array.isArray(body)) {
			return badRequest({ error: "Invalid JSON: expected an object" });
		}
		return body as Record<string, unknown>;
	} catch {
		return badRequest({ error: "Invalid JSON body" });
	}
}

/**
 * Type guard narrowing a value to `Response`, used to tell a parse failure from
 * a parsed body returned by {@link safeJsonParse}.
 * @param value - The value to test.
 * @returns True when `value` is a `Response` instance.
 */
export function isResponse(value: unknown): value is Response {
	return value instanceof Response;
}

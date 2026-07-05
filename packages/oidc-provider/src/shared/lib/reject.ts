/**
 * Helper for building RFC 6749 OAuth 2.0 error responses.
 *
 * Centralizes the `{ error, error_description }` JSON shape and the `no-store`
 * cache header every OAuth/OIDC error must send, so controllers reject requests
 * consistently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@pkg/http/response";

/**
 * Builds a JSON OAuth 2.0 error response with the standard `error`/`error_description`
 * body and a `Cache-Control: no-store` header.
 * @param error - The OAuth 2.0 error code (e.g. `"invalid_request"`).
 * @param description - Human-readable explanation of the error.
 * @param status - HTTP status code to return (defaults to 400).
 * @returns A `Response` carrying the error as JSON.
 * @example
 * return reject("invalid_grant", "Authorization code expired", 400);
 */
export function reject(error: string, description: string, status: number = 400) {
	return json(
		{ error, error_description: description },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}

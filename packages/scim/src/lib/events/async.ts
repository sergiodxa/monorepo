/**
 * RFC 9967 §2.5.1's asynchronous requests: reading `Prefer: respond-async`, and the empty
 * `202 Accepted` whose `Set-Txn` header names the transaction the completion event's
 * `txn` claim will carry, so the client can match the two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The response header RFC 9967 §3 registers. */
export const SET_TXN_HEADER = "Set-Txn";

/**
 * Whether the request asks for asynchronous processing (RFC 7240 §4.1), read from every
 * `Prefer` preference case-insensitively.
 *
 * @param request - The incoming request
 * @returns `true` when `respond-async` is among the preferences
 */
export function prefersAsync(request: Request): boolean {
	let header = request.headers.get("Prefer");
	if (!header) return false;
	return header
		.split(",")
		.some((preference) => preference.split(/[;=]/)[0]?.trim().toLowerCase() === "respond-async");
}

/**
 * The `202 Accepted` answer to an asynchronous request: no body, `Set-Txn`, and
 * `Preference-Applied: respond-async`, as RFC 9967 §2.5.1.1 requires.
 *
 * @param options - The transaction, and where the resource or the completion event lives
 * @returns The response
 * @example acceptedResponse({ transaction: txn, location: `/Users/${id}` })
 */
export function acceptedResponse(options: { transaction: string; location: string }): Response {
	return new Response(null, {
		status: 202,
		headers: {
			[SET_TXN_HEADER]: options.transaction,
			"Preference-Applied": "respond-async",
			Location: options.location,
		},
	});
}

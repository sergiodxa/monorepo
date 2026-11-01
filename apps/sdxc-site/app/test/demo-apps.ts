/**
 * Test helpers for the demo apps' form posts: a redirect's toast carries a one-time suffix,
 * so a test compares the address the visitor lands on by the toast's key alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Drops the one-time suffix from a redirect's `toast` parameter, leaving the toast's key.
 *
 * @param location A `Location` header or address, or `null` when the response had none.
 * @returns The same address with `toast=<key>`.
 * @example withoutToastNonce("/demo/apps/pulse/services?toast=service-deleted.9f3a1c2e") // "/demo/apps/pulse/services?toast=service-deleted"
 */
export function withoutToastNonce(location: string | null | undefined): string | null | undefined {
	return location?.replace(/([?&]toast=[^&.#]+)\.[0-9a-f]{8}/, "$1");
}

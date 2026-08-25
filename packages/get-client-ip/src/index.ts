/**
 * Resolves the connecting client's IP address on Cloudflare Workers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Returns the client's IP address from a Cloudflare Workers request.
 *
 * Reads the CF-Connecting-IP header, which Cloudflare automatically
 * attaches with the client's IP address on every request.
 *
 * @param request - The incoming Request object
 * @returns The client's IP address or null if not available
 */
export function getClientIP(request: Request): string | null {
	return request.headers.get("CF-Connecting-IP");
}

/**
 * Get the client's IP address from a Cloudflare Workers request.
 *
 * Uses the CF-Connecting-IP header which Cloudflare automatically adds
 * to all requests with the client's IP address.
 *
 * @param request - The incoming Request object
 * @returns The client's IP address or null if not available
 */
export function getClientIP(request: Request): string | null {
	return request.headers.get("CF-Connecting-IP");
}

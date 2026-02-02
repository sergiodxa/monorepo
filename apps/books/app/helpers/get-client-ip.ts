/**
 * Get the client's IP address from a Cloudflare Workers request.
 *
 * Uses the Cloudflare-specific request.cf property first,
 * then falls back to the CF-Connecting-IP header.
 *
 * @param request - The incoming Request object
 * @returns The client's IP address or null if not available
 */
export function getClientIPAddress(request: Request): string | null {
	// Try Cloudflare's request context first
	const cfIP = (request as Request & { cf?: { ip?: string } }).cf?.ip;
	if (typeof cfIP === "string") return cfIP;

	// Fallback to CF-Connecting-IP header
	const headerIP = request.headers.get("CF-Connecting-IP");
	if (headerIP) return headerIP;

	// No IP found
	return null;
}

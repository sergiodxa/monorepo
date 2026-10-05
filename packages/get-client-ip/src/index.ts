/**
 * Resolves the connecting client's IP address on Cloudflare Workers, parsed into
 * an `IP` so a malformed header never becomes a rate limit key or a stored address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IP } from "@sdxc/ip";
import { isSuccess } from "@sdxc/result";

/**
 * Returns the client's address from the `CF-Connecting-IP` header Cloudflare
 * attaches to every request it routes. A missing header and a malformed one both
 * answer `null`, so one fallback covers every request Cloudflare did not vouch for.
 *
 * @param request - The incoming request.
 * @returns The parsed address, or `null` when the header is absent or not an address.
 * @example
 * let key = getClientIP(request)?.network({ v4: 32, v6: 64 }).toString() ?? "unknown";
 */
export function getClientIP(request: Request): IP | null {
	let header = request.headers.get("CF-Connecting-IP");
	if (header === null) return null;
	let ip = IP.parse(header);
	return isSuccess(ip) ? ip.data : null;
}

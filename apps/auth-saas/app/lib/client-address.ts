/**
 * The connecting address a request-volume budget is keyed on: an IPv4 address
 * kept whole, an IPv6 address bucketed to its /64 so one machine's rotating
 * suffix still shares one budget, and a request that reports neither sharing
 * one fallback bucket.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getClientIP } from "@sdxc/get-client-ip";

/** The bucket every request with no reported address, or a malformed one, shares. */
const UNKNOWN_ADDRESS = "unknown";

/**
 * Resolves the address a request's rate limit budget is spent against. The key
 * is the canonical range text, so every spelling of one address, and every
 * address in one IPv6 /64, spends the same budget.
 *
 * @param request - The incoming request.
 * @returns The client's `/32` or `/64` network, or the shared fallback bucket
 * when `CF-Connecting-IP` is absent or malformed.
 * @example
 * clientAddressKey(request); // "203.0.113.42/32"
 * @example
 * clientAddressKey(request); // "2001:db8:85a3::/64", for any address in that /64
 */
export function clientAddressKey(request: Request): string {
	let ip = getClientIP(request);
	if (!ip) return UNKNOWN_ADDRESS;
	return ip.network({ v4: 32, v6: 64 }).toString();
}

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

/** The bucket every request with no reported address shares. */
const UNKNOWN_ADDRESS = "unknown";

/** An IPv6 address's groups, full length and how many make up its /64 prefix. */
const IPV6_GROUP_COUNT = 8;
const IPV6_PREFIX_GROUP_COUNT = 4;

/**
 * Expands an IPv6 address's `::` zero-compression into its full 8 groups, so
 * a prefix taken from it means the same bits regardless of how the address
 * was written. A zone id (`%eth0`) is dropped first, since it names a local
 * interface rather than anything a budget should be scoped by.
 *
 * @param address - The address text as reported.
 * @returns The address's 8 colon-separated groups.
 */
function expandIpv6Groups(address: string): string[] {
	let withoutZone = address.split("%")[0] ?? address;

	if (!withoutZone.includes("::")) return withoutZone.split(":");

	let [head, tail] = withoutZone.split("::");
	let headGroups = head ? head.split(":") : [];
	let tailGroups = tail ? tail.split(":") : [];
	let missing = Math.max(IPV6_GROUP_COUNT - headGroups.length - tailGroups.length, 0);

	return [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups];
}

/**
 * Resolves the address a request's rate limit budget is spent against.
 *
 * @param request - The incoming request.
 * @returns The connecting IPv4 address as reported, an IPv6 address's /64
 * prefix, or the shared fallback bucket when the request reports neither.
 * @example
 * clientAddressKey(request); // "203.0.113.42"
 * @example
 * clientAddressKey(request); // "2001:db8:85a3:0", for any address in that /64
 */
export function clientAddressKey(request: Request): string {
	let ip = getClientIP(request);
	if (!ip) return UNKNOWN_ADDRESS;
	if (!ip.includes(":")) return ip;

	return expandIpv6Groups(ip).slice(0, IPV6_PREFIX_GROUP_COUNT).join(":");
}

/**
 * The budget key for an anonymous caller's connecting address: an IPv4 address
 * kept whole, an IPv6 address widened to the `/64` one subscriber is handed, and
 * one shared bucket for a request whose address is missing or unreadable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * A parsed address that can name the network it sits in, at a prefix length per
 * version; the range's text must be canonical, so every spelling of one network
 * keys one budget. An `IP` from `@sdxc/ip` or `@sdxc/get-client-ip` fits it.
 */
export interface RateLimitAddress {
	/**
	 * @param prefixes - The prefix length to widen each version's address to.
	 * @returns The network, whose text becomes the key.
	 */
	network(prefixes: { v4: number; v6: number }): { toString(): string };
}

/**
 * The bucket every request without a usable address shares, so an unidentified
 * caller still spends a budget instead of skipping the limit.
 */
export const UNKNOWN_ADDRESS_KEY = "unknown";

/**
 * Keys a budget on the network a client address sits in. An IPv6 client holds a
 * whole `/64` and rotates through it, so every address in one `/64` spends one
 * budget; callers sharing an egress address share one too.
 *
 * @param address - The parsed client address, or `null` when the request reported none.
 * @returns The canonical `/32` or `/64` range text, or {@link UNKNOWN_ADDRESS_KEY}.
 * @example addressKey(getClientIP(request)); // "203.0.113.42/32"
 * @example addressKey(ctx.ip); // "2001:db8:85a3::/64", for any address in that /64
 */
export function addressKey(address: RateLimitAddress | null | undefined): string {
	return address?.network({ v4: 32, v6: 64 }).toString() ?? UNKNOWN_ADDRESS_KEY;
}

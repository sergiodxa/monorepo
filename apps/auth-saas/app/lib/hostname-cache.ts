/**
 * Shared helpers for the `HOSTNAMES_KV` cache that maps a hostname to its tenant.
 * The worker writes entries with a short TTL (so a stale mapping self-heals) and the
 * hostname/tenant models invalidate them on any change that affects resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/**
 * Builds the KV key under which a hostname's tenant resolution is cached.
 *
 * @param hostname - The request hostname to build a cache key for.
 * @returns The namespaced KV key (e.g. `host:example.com`).
 * @example
 * await env.HOSTNAMES_KV.get(hostnameCacheKey("app.example.com"));
 */
export function hostnameCacheKey(hostname: string): string {
	return `host:${hostname}`;
}

/**
 * Time-to-live (seconds) for a cached hostname resolution. Kept short so a missed
 * invalidation self-heals within minutes.
 */
export const HOSTNAME_CACHE_TTL = 300;

/**
 * Removes a hostname's cached resolution so the next request re-reads D1.
 *
 * @param hostname - The hostname whose cached resolution should be evicted.
 * @returns A promise that resolves once the KV entry has been deleted.
 * @example
 * await invalidateHostnameCache("app.example.com");
 */
export async function invalidateHostnameCache(hostname: string): Promise<void> {
	await env.HOSTNAMES_KV.delete(hostnameCacheKey(hostname));
}

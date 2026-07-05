import { env } from "cloudflare:workers";

/**
 * Shared helpers for the `HOSTNAMES_KV` cache that maps a hostname to its tenant.
 * The worker writes entries with a short TTL (so a stale mapping self-heals) and the
 * hostname/tenant models invalidate them on any change that affects resolution.
 */

/** KV key for a cached hostname -> tenant resolution. */
export function hostnameCacheKey(hostname: string): string {
	return `host:${hostname}`;
}

/**
 * Time-to-live (seconds) for a cached hostname resolution. Kept short so that a
 * missed invalidation cannot route to a stale tenant for long.
 */
export const HOSTNAME_CACHE_TTL = 300;

/** Removes a hostname's cached resolution so the next request re-reads D1. */
export async function invalidateHostnameCache(hostname: string): Promise<void> {
	await env.HOSTNAMES_KV.delete(hostnameCacheKey(hostname));
}

/**
 * The `HOSTNAMES_KV` cache mapping a hostname to its tenant resolution: what a request
 * needs to route to a tenant's Durable Object without a control-plane read. Holds both
 * positive resolutions and negative (miss) entries for hostnames that match no tenant,
 * so unknown traffic costs one D1 read per hostname per cache period rather than one
 * per request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/**
 * A hostname's resolved tenant: what a request needs to route to the tenant's Durable
 * Object and build absolute URLs under its issuer, with no further read.
 */
export interface HostnameResolution {
	tenantId: string;
	region: string;
	issuer: string;
}

/** What a hostname matching no tenant caches as, so a repeat miss skips D1 entirely. */
interface HostnameCacheMiss {
	miss: true;
}

/** Time-to-live (seconds) for a positive resolution. */
export const HOSTNAME_CACHE_TTL = 300;

/**
 * Time-to-live (seconds) for a negative (miss) entry — shorter than the positive TTL
 * since a hostname that starts resolving (a domain activating) should wait less than
 * five minutes to do so, on top of `invalidateHostnameCache` already clearing it then.
 */
export const HOSTNAME_MISS_CACHE_TTL = 60;

/**
 * Builds the KV key a hostname's resolution is cached under. The `hostname` must
 * already be lowercased, in its ASCII form, and without a port — the same form
 * `new URL(request.url).hostname` already produces per the URL spec, so callers
 * reading it from a request need no separate normalization step. The `v1` segment
 * lets a future change to {@link HostnameResolution}'s shape ship as a new prefix,
 * leaving old entries to expire unread rather than requiring a cache-wide purge.
 *
 * @param hostname - The already-normalized request hostname to build a cache key for.
 * @returns The namespaced KV key (e.g. `host:v1:example.com`).
 * @example
 * await env.HOSTNAMES_KV.get(hostnameCacheKey(new URL(request.url).hostname));
 */
export function hostnameCacheKey(hostname: string): string {
	return `host:v1:${hostname}`;
}

/**
 * Reads a hostname's cached resolution.
 *
 * @param hostname - The already-normalized request hostname to look up.
 * @returns The cached resolution, `"miss"` when the hostname is negatively cached as
 * matching no tenant, or `null` when nothing is cached and D1 has to be read.
 * @example
 * let cached = await readHostnameCache("acme.auth.example.com");
 * if (cached === "miss") return null;
 * if (cached) return cached;
 */
export async function readHostnameCache(
	hostname: string,
): Promise<HostnameResolution | "miss" | null> {
	let cached = await env.HOSTNAMES_KV.get<HostnameResolution | HostnameCacheMiss>(
		hostnameCacheKey(hostname),
		"json",
	);
	if (!cached) return null;
	if ("miss" in cached) return "miss";
	return cached;
}

/**
 * Caches a hostname's resolution for {@link HOSTNAME_CACHE_TTL} seconds.
 *
 * @param hostname - The already-normalized hostname the resolution was read for.
 * @param resolution - The tenant, region and issuer the hostname resolves to.
 * @returns A promise that resolves once the KV entry is written.
 * @example
 * await writeHostnameCache("acme.auth.example.com", { tenantId, region, issuer });
 */
export async function writeHostnameCache(
	hostname: string,
	resolution: HostnameResolution,
): Promise<void> {
	await env.HOSTNAMES_KV.put(hostnameCacheKey(hostname), JSON.stringify(resolution), {
		expirationTtl: HOSTNAME_CACHE_TTL,
	});
}

/**
 * Caches that a hostname matches no tenant, for {@link HOSTNAME_MISS_CACHE_TTL}
 * seconds, so repeated traffic for an unknown hostname costs one D1 read per minute.
 *
 * @param hostname - The already-normalized hostname that matched no tenant.
 * @returns A promise that resolves once the tombstone is written.
 * @example
 * await writeHostnameCacheMiss("scanner.example.com");
 */
export async function writeHostnameCacheMiss(hostname: string): Promise<void> {
	await env.HOSTNAMES_KV.put(
		hostnameCacheKey(hostname),
		JSON.stringify({ miss: true } satisfies HostnameCacheMiss),
		{ expirationTtl: HOSTNAME_MISS_CACHE_TTL },
	);
}

/**
 * Removes a hostname's cached entry, positive or negative, so the next request
 * re-reads D1. Called when a domain activates, is removed, or a tenant's status
 * changes — since a positive resolution and a miss tombstone share the same key,
 * activating a domain that was previously cached as a miss clears that tombstone too.
 *
 * @param hostname - The hostname whose cached entry should be evicted.
 * @returns A promise that resolves once the KV entry has been deleted.
 * @example
 * await invalidateHostnameCache("app.example.com");
 */
export async function invalidateHostnameCache(hostname: string): Promise<void> {
	await env.HOSTNAMES_KV.delete(hostnameCacheKey(hostname));
}

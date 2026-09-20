/**
 * The Cloudflare Worker entry point. Routes every incoming request to the right place —
 * static assets, the platform Worker router, or a tenant Durable Object (resolved via
 * Cloudflare for SaaS `hostMetadata` or a KV-cached control-plane lookup). Also
 * re-exports the {@link Tenant} Durable Object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";

import { isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";

import { HostMetadataSchema } from "~/app/lib/host-metadata";
import { HOSTNAME_CACHE_TTL, hostnameCacheKey } from "~/app/lib/hostname-cache";
import { checkRateLimit } from "~/app/lib/rate-limit";

import { router } from "./app";
import Tenant from "./tenant";

export { Tenant };

interface ResolvedTenant {
	tenantId: string;
	region?: string;
}

function isPlatformHost(hostname: string): boolean {
	if (hostname === env.PLATFORM_DOMAIN) return true;
	if (hostname === "localhost" || hostname === "127.0.0.1") return true;
	if (hostname.endsWith(".workers.dev")) return true;
	return false;
}

/**
 * Resolves hostnames `hostMetadata` can't cover via a KV-cached control-plane
 * lookup. Filters to active tenants so suspended or deleted ones stop routing
 * at the edge; the short cache TTL bounds staleness if invalidation is missed.
 */
async function resolveHostname(hostname: string): Promise<ResolvedTenant | null> {
	let cacheKey = hostnameCacheKey(hostname);
	let cached = await env.HOSTNAMES_KV.get<ResolvedTenant>(cacheKey, "json");
	if (cached) return cached;

	let row = await env.PLATFORM_DB.prepare(
		`SELECT d.tenant_id AS tenantId, t.region AS region
		 FROM domains d
		 JOIN tenants t ON t.id = d.tenant_id
		 WHERE d.hostname = ?1 AND d.status = 'active' AND t.status = 'active'
		 LIMIT 1`,
	)
		.bind(hostname)
		.first<ResolvedTenant>();
	if (!row) return null;

	let resolved: ResolvedTenant = { tenantId: row.tenantId, region: row.region };
	await env.HOSTNAMES_KV.put(cacheKey, JSON.stringify(resolved), {
		expirationTtl: HOSTNAME_CACHE_TTL,
	});
	return resolved;
}

/**
 * Forwards a request to a tenant Durable Object after applying rate limits.
 * The tenant's region code doubles as the Durable Object location hint.
 */
async function forwardToTenant(request: Request, target: ResolvedTenant): Promise<Response> {
	let rateLimitResponse = await checkRateLimit(request, {
		authLimiter: env.AUTH_RATE_LIMITER,
		strictLimiter: env.STRICT_RATE_LIMITER,
		managementLimiter: env.MANAGEMENT_RATE_LIMITER,
	});
	if (rateLimitResponse) return rateLimitResponse;

	let locationHint = target.region as DurableObjectLocationHint | undefined;
	let stub = env.TENANT.getByName(target.tenantId, locationHint ? { locationHint } : undefined);
	return await stub.fetch(request);
}

/**
 * The worker's exported handler, implementing the `fetch` (HTTP) runtime hook.
 */
export default {
	/**
	 * Routes an incoming HTTP request: static assets first, then the platform
	 * Worker router or a tenant Durable Object by host and path.
	 *
	 * @param request - The incoming request.
	 * @returns The response from assets, the platform router, or a tenant DO (or a 404
	 * when the host cannot be resolved).
	 */
	async fetch(request) {
		let url = new URL(request.url);
		let hostname = url.hostname;

		let assetRequest = new Request(request.url, {
			method: request.method,
			headers: request.headers,
		});
		let asset = await env.ASSETS.fetch(assetRequest);
		if (asset.ok) return asset;

		if (isPlatformHost(hostname)) return await router.fetch(request);

		let hostMetadata = request.cf?.hostMetadata;
		if (hostMetadata) {
			let result = await validate(hostMetadata as JSONValue, HostMetadataSchema);
			if (isSuccess(result)) {
				return await forwardToTenant(request, {
					tenantId: result.data.tenant_id,
					region: result.data.region,
				});
			}
		}

		let resolved = await resolveHostname(hostname);
		if (resolved) return await forwardToTenant(request, resolved);

		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Cloudflare.Env>;

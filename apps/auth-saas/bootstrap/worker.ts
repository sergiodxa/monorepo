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
import Tenant from "~/database/tenant-do";

import { router } from "./app";

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
 * Rate-limits a request resolved to a tenant, then answers it. A tenant's protocol
 * endpoints — `/authorize`, `/oauth/token` and the rest — are typed RPC methods on its
 * Durable Object, so a request naming this tenant is met with what is true about it today
 * rather than a call the object has no handler for.
 */
async function forwardToTenant(request: Request, target: ResolvedTenant): Promise<Response> {
	let rateLimitResponse = await checkRateLimit(request, {
		authLimiter: env.AUTH_RATE_LIMITER,
		strictLimiter: env.STRICT_RATE_LIMITER,
		managementLimiter: env.MANAGEMENT_RATE_LIMITER,
	});
	if (rateLimitResponse) return rateLimitResponse;

	return new Response(
		JSON.stringify({
			tenantId: target.tenantId,
			message:
				"This tenant's protocol endpoints are served through typed RPC methods on its Durable Object.",
		}),
		{ status: 501, headers: { "Content-Type": "application/json" } },
	);
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

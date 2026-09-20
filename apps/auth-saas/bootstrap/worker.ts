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

import { refreshPendingDomains } from "~/app/jobs/refresh-pending-domains";
import { HostMetadataSchema } from "~/app/lib/host-metadata";
import {
	readHostnameCache,
	writeHostnameCache,
	writeHostnameCacheMiss,
} from "~/app/lib/hostname-cache";
import { checkRateLimit } from "~/app/lib/rate-limit";
import Tenant from "~/database/tenant-do";

import { router } from "./app";

export { Tenant };

interface ResolvedTenant {
	tenantId: string;
	region: string;
	issuer: string;
}

function isPlatformHost(hostname: string): boolean {
	if (hostname === env.PLATFORM_DOMAIN) return true;
	if (hostname === "localhost" || hostname === "127.0.0.1") return true;
	if (hostname.endsWith(".workers.dev")) return true;
	return false;
}

/**
 * Resolves hostnames `hostMetadata` can't cover via a KV-cached control-plane lookup.
 * Filters out only deleted tenants: a suspended tenant still resolves, because
 * suspension is answered inside the request rather than at resolution, which keeps
 * the management surface reachable and lets a reinstated tenant serve immediately
 * rather than waiting out a cache entry. A hostname matching nothing is negatively
 * cached so repeated unknown-hostname traffic costs one D1 read per minute.
 */
async function resolveHostname(hostname: string): Promise<ResolvedTenant | null> {
	let cached = await readHostnameCache(hostname);
	if (cached === "miss") return null;
	if (cached) return cached;

	let row = await env.PLATFORM_DB.prepare(
		`SELECT d.tenant_id AS tenantId, t.region AS region, t.issuer AS issuer
		 FROM domains d
		 JOIN tenants t ON t.id = d.tenant_id
		 WHERE d.hostname = ?1 AND d.status = 'active' AND t.status != 'deleted'
		 LIMIT 1`,
	)
		.bind(hostname)
		.first<ResolvedTenant>();

	if (!row) {
		await writeHostnameCacheMiss(hostname);
		return null;
	}

	await writeHostnameCache(hostname, row);
	return row;
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
					issuer: result.data.issuer,
				});
			}
		}

		let resolved = await resolveHostname(hostname);
		if (resolved) return await forwardToTenant(request, resolved);

		return new Response("Not found", { status: 404 });
	},

	/**
	 * The worker's `scheduled` (cron) runtime hook: runs the daily sweep over domains
	 * still pending verification or certificate issuance.
	 *
	 * @returns A promise that resolves once the sweep completes.
	 */
	async scheduled() {
		await refreshPendingDomains();
	},
} satisfies ExportedHandler<Cloudflare.Env>;

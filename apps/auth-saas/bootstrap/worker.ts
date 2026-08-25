/**
 * The Cloudflare Worker entry point. Routes every incoming request to the right place —
 * static assets, the platform dashboard router, or a tenant Durable Object (resolved via
 * Cloudflare for SaaS `hostMetadata` or a KV-cached control-plane lookup) — and runs the
 * daily scheduled MAU-reporting cron. Also re-exports the {@link Tenant} Durable Object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@pkg/types";

import { isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";

import { reportMAU } from "~/app/jobs/report-mau";
import { container } from "~/app/lib/container";
import { HostMetadataSchema } from "~/app/lib/host-metadata";
import { HOSTNAME_CACHE_TTL, hostnameCacheKey } from "~/app/lib/hostname-cache";
import { ensurePlatformProvisioned, PLATFORM_TENANT } from "~/app/lib/platform-bootstrap";
import { checkRateLimit } from "~/app/lib/rate-limit";

import { router } from "./app";
import Tenant from "./tenant";

export { Tenant };

interface ResolvedTenant {
	tenantId: string;
	region?: string;
}

/**
 * Path prefixes served by the tenant Durable Object (the OIDC provider surface).
 * On the platform domain these route to the platform tenant; everything else
 * there is handled by the dashboard router.
 */
const TENANT_PATHS = [
	"/authorize",
	"/oauth/",
	"/oidc/",
	"/userinfo",
	"/webauthn/",
	"/.well-known/",
	"/verify-email",
	"/magic-link/",
	"/api/",
];

/**
 * Platform-domain paths always served by the dashboard router, checked ahead
 * of tenant path matching.
 */
const ROUTER_PATHS = ["/api/webhooks/"];

function isPlatformHost(hostname: string): boolean {
	if (hostname === env.PLATFORM_DOMAIN) return true;
	if (hostname === "localhost" || hostname === "127.0.0.1") return true;
	if (hostname.endsWith(".workers.dev")) return true;
	return false;
}

function isTenantPath(pathname: string): boolean {
	if (ROUTER_PATHS.some((prefix) => pathname.startsWith(prefix))) return false;
	return TENANT_PATHS.some((prefix) =>
		prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix,
	);
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
		`SELECT h.tenant_id AS tenantId, t.region AS region
		 FROM hostnames h
		 JOIN tenants t ON t.id = h.tenant_id
		 WHERE h.hostname = ?1 AND h.status = 'active' AND t.status = 'active'
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
	let stub =
		target.tenantId === PLATFORM_TENANT
			? env.TENANT.getByName(PLATFORM_TENANT)
			: env.TENANT.getByName(target.tenantId, locationHint ? { locationHint } : undefined);
	return await stub.fetch(request);
}

/**
 * The worker's exported handler, implementing the `fetch` (HTTP) and `scheduled` (cron)
 * runtime hooks.
 */
export default {
	/**
	 * Routes an incoming HTTP request: static assets first, then the platform
	 * dashboard router or a tenant Durable Object by host and path, provisioning
	 * the platform tenant's issuer first since its DO is never set up via /api/setup.
	 *
	 * @param request - The incoming request.
	 * @returns The response from assets, the dashboard router, or a tenant DO (or a 404
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

		if (isPlatformHost(hostname)) {
			if (isTenantPath(url.pathname)) {
				await ensurePlatformProvisioned(undefined, env.PLATFORM_DOMAIN);
				return await forwardToTenant(request, { tenantId: PLATFORM_TENANT });
			}
			return await container.scope(() => router.fetch(request));
		}

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

	/**
	 * Cron entry point: runs scheduled jobs within a container scope. Currently triggers
	 * the daily MAU reporting job at 1:00 AM UTC.
	 *
	 * @param controller - The Cloudflare scheduled controller carrying the cron pattern.
	 * @returns A promise that resolves once the matched job(s) complete.
	 */
	async scheduled(controller) {
		await container.scope(async () => {
			if (controller.cron === "0 1 * * *") {
				await reportMAU(controller);
			}
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;

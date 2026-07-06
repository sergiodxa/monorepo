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

/** Resolved tenant target for a request. */
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
	"/api/", // tenant Management API (dashboard webhooks live under /api/webhooks on the router)
];

/** Router-owned paths on the platform domain that must never reach a tenant DO. */
const ROUTER_PATHS = ["/api/webhooks/"];

/** Returns true when the hostname is the platform domain or a local/dev host. */
function isPlatformHost(hostname: string): boolean {
	if (hostname === env.PLATFORM_DOMAIN) return true;
	if (hostname === "localhost" || hostname === "127.0.0.1") return true;
	if (hostname.endsWith(".workers.dev")) return true;
	return false;
}

/** Returns true when a platform-domain path belongs to the platform tenant DO. */
function isTenantPath(pathname: string): boolean {
	if (ROUTER_PATHS.some((prefix) => pathname.startsWith(prefix))) return false;
	return TENANT_PATHS.some((prefix) =>
		prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix,
	);
}

/**
 * Resolves a non-platform hostname to its tenant via the control-plane database,
 * cached in KV. Covers same-zone custom hostnames (e.g. sso.sergiodxa.com) and
 * default subdomains, for which Cloudflare for SaaS `hostMetadata` is unavailable.
 */
async function resolveHostname(hostname: string): Promise<ResolvedTenant | null> {
	let cacheKey = hostnameCacheKey(hostname);
	let cached = await env.HOSTNAMES_KV.get<ResolvedTenant>(cacheKey, "json");
	if (cached) return cached;

	let row = await env.PLATFORM_DB.prepare(
		// Only active tenants resolve: suspended (billing lapse / operator action) and
		// deleted tenants must stop routing to their DO. The tenant DO also enforces its
		// own suspension flag, but excluding them here stops resolution at the edge and
		// keeps the `hostMetadata`/KV re-check honest once the cache is invalidated.
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
	// Short TTL bounds staleness even if an invalidation is ever missed.
	await env.HOSTNAMES_KV.put(cacheKey, JSON.stringify(resolved), {
		expirationTtl: HOSTNAME_CACHE_TTL,
	});
	return resolved;
}

/** Forwards a request to a tenant Durable Object after applying rate limits. */
async function forwardToTenant(request: Request, target: ResolvedTenant): Promise<Response> {
	let rateLimitResponse = await checkRateLimit(request, {
		authLimiter: env.AUTH_RATE_LIMITER,
		strictLimiter: env.STRICT_RATE_LIMITER,
		managementLimiter: env.MANAGEMENT_RATE_LIMITER,
	});
	if (rateLimitResponse) return rateLimitResponse;

	// The tenant region codes are the Durable Object location-hint values.
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
	 * Routes an incoming HTTP request: static assets first, then the platform dashboard
	 * router or the appropriate tenant Durable Object depending on host and path.
	 *
	 * @param request - The incoming request.
	 * @returns The response from assets, the dashboard router, or a tenant DO (or a 404
	 * when the host cannot be resolved).
	 */
	async fetch(request) {
		let url = new URL(request.url);
		let hostname = url.hostname;

		// 1. Static assets (clone first: request bodies can only be read once).
		let assetRequest = new Request(request.url, {
			method: request.method,
			headers: request.headers,
		});
		let asset = await env.ASSETS.fetch(assetRequest);
		if (asset.ok) return asset;

		// 2. Platform domain: OIDC surface -> platform tenant DO, everything else -> dashboard router.
		if (isPlatformHost(hostname)) {
			if (isTenantPath(url.pathname)) {
				// The platform tenant row is seeded by migration but its DO is never set up
				// via /api/setup, so provision its issuer once before serving OIDC traffic;
				// otherwise dashboard token exchange fails with "Issuer not configured".
				await ensurePlatformProvisioned(undefined, env.PLATFORM_DOMAIN);
				return await forwardToTenant(request, { tenantId: PLATFORM_TENANT });
			}
			return await container.scope(() => router.fetch(request));
		}

		// 3. Custom hostname carrying Cloudflare for SaaS metadata -> tenant DO.
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

		// 4. Same-zone / other hostname -> control-plane lookup (KV-cached) -> tenant DO.
		let resolved = await resolveHostname(hostname);
		if (resolved) return await forwardToTenant(request, resolved);

		// 5. Unknown host.
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
			// Daily MAU reporting job (runs at 1:00 AM UTC)
			if (controller.cron === "0 1 * * *") {
				await reportMAU(controller);
			}
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;

import type { JSONValue } from "@pkg/types";

import { isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";

import { reportMAU } from "./app/jobs/report-mau";
import { router } from "./app/router";
import { HostMetadataSchema } from "./lib/host-metadata";
import { checkRateLimit } from "./lib/rate-limit";
import Tenant from "./tenant";

export { Tenant };

/** Special Durable Object name for the dogfooding "platform" tenant. */
const PLATFORM_TENANT = "platform";

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
	let cacheKey = `host:${hostname}`;
	let cached = await env.HOSTNAMES_KV.get<ResolvedTenant>(cacheKey, "json");
	if (cached) return cached;

	let row = await env.PLATFORM_DB.prepare(
		`SELECT h.tenant_id AS tenantId, t.region AS region
		 FROM hostnames h
		 JOIN tenants t ON t.id = h.tenant_id
		 WHERE h.hostname = ?1 AND h.status = 'active' AND t.status != 'deleted'
		 LIMIT 1`,
	)
		.bind(hostname)
		.first<ResolvedTenant>();
	if (!row) return null;

	let resolved: ResolvedTenant = { tenantId: row.tenantId, region: row.region };
	await env.HOSTNAMES_KV.put(cacheKey, JSON.stringify(resolved));
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

export default {
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
				return await forwardToTenant(request, { tenantId: PLATFORM_TENANT });
			}
			return await router.fetch(request);
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

	async scheduled(controller) {
		// Daily MAU reporting job (runs at 1:00 AM UTC)
		if (controller.cron === "0 1 * * *") {
			await reportMAU(controller);
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;

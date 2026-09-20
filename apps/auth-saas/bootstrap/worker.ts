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

import * as cloudflare from "@sdxc/jobs/cloudflare";
import { isSuccess } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { env } from "cloudflare:workers";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
} from "~/app/http/middleware/tenant";
import { dispatcher } from "~/app/jobs/dispatcher";
import { HostMetadataSchema } from "~/app/lib/host-metadata";
import {
	readHostnameCache,
	writeHostnameCache,
	writeHostnameCacheMiss,
} from "~/app/lib/hostname-cache";
import { checkRateLimit } from "~/app/lib/rate-limit";
import Tenant from "~/database/tenant-do";

import { router } from "./app";
import { tenantRouter } from "./tenant-app";

export { Tenant };

/** Both worker handlers, bound to the dispatcher they delegate to. */
const jobHandlers = cloudflare.worker(dispatcher);

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
 * Rate-limits a request resolved to a tenant, then hands it to the tenant router:
 * a request naming this tenant is met with what is true about it today, through
 * the typed RPC methods its Durable Object exposes, rather than a route this
 * Worker assembles by hand. The resolved tenant crosses into that router on
 * internal headers stamped onto the request here, since it is resolved once, on
 * this hostname lookup, before the tenant router ever sees the request.
 */
async function forwardToTenant(request: Request, target: ResolvedTenant): Promise<Response> {
	let rateLimitResponse = await checkRateLimit(request, {
		authLimiter: env.AUTH_RATE_LIMITER,
		strictLimiter: env.STRICT_RATE_LIMITER,
		managementLimiter: env.MANAGEMENT_RATE_LIMITER,
	});
	if (rateLimitResponse) return rateLimitResponse;

	let headers = new Headers(request.headers);
	headers.set(TENANT_ID_HEADER, target.tenantId);
	headers.set(TENANT_REGION_HEADER, target.region);
	headers.set(TENANT_ISSUER_HEADER, target.issuer);

	return await tenantRouter.fetch(new Request(request, { headers }));
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
	 * Cron entrypoint. Enqueues every job whose declared schedule is the one that fired
	 * and returns; the work itself happens on the queue delivery.
	 *
	 * @param controller - The scheduled controller carrying the triggering `cron`.
	 */
	async scheduled(controller) {
		await jobHandlers.scheduled(controller);
	},

	/**
	 * Queue entrypoint. Runs each message in the batch through its job's handler and
	 * the dispatcher's middleware chain.
	 *
	 * @param batch - The batch of enqueued job messages to process.
	 */
	async queue(batch) {
		await jobHandlers.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

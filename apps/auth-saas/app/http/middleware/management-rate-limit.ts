/**
 * Gates a management API route on the resolved caller's own request budget,
 * reusing the same `MANAGEMENT_RATE_LIMITER` binding `scim-gate.ts` already wires
 * up, keyed on the caller `managementAuth` already resolved — the management
 * client id, or the member id — rather than the address it happens to call from.
 * Mounted after `managementAuth`, whose caller this middleware reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Middleware } from "remix/router";

import { CloudflareAdapter, tooManyRequests } from "@sdxc/rate-limit";
import { isFailure } from "@sdxc/result";

import Tenant from "~/app/models/tenant";

/** Which budget a route spends from. Import and export runs are their own bucket, opted into explicitly rather than inferred from the HTTP method. */
export type ManagementRateLimitBucket = "read" | "write" | "import_export";

/** Requests or runs admitted per window, at a tenant's own plan. */
interface TierLimits {
	reads: number;
	writes: number;
	importExport: number;
}

/** The ADR's own table: reads and writes per minute, import/export runs per hour. */
const TIER_LIMITS: Record<string, TierLimits> = {
	free: { reads: 60, writes: 20, importExport: 1 },
	pro: { reads: 600, writes: 200, importExport: 5 },
	premium: { reads: 1800, writes: 600, importExport: 20 },
};

/** The tier a plan slug this app does not recognize falls back to. */
const DEFAULT_TIER: TierLimits = TIER_LIMITS.free!;

/** The counting window a bucket's budget resets on. */
function windowFor(bucket: ManagementRateLimitBucket): "60 seconds" | "1 hour" {
	return bucket === "import_export" ? "1 hour" : "60 seconds";
}

/** The limit a tier grants a bucket. */
function limitFor(tier: TierLimits, bucket: ManagementRateLimitBucket): number {
	if (bucket === "read") return tier.reads;
	if (bucket === "write") return tier.writes;
	return tier.importExport;
}

/** `GET`/`HEAD` spend the read budget; every other method spends the write budget. */
function bucketForMethod(method: string): ManagementRateLimitBucket {
	return method === "GET" || method === "HEAD" ? "read" : "write";
}

export interface ManagementRateLimitOptions {
	/** Which budget this route spends from, defaulting to the caller's own HTTP method. */
	bucket?: ManagementRateLimitBucket;
}

/**
 * Builds the rate-limiting middleware for one management API route.
 *
 * @param limiter - The `MANAGEMENT_RATE_LIMITER` binding.
 * @param options - Which budget this route spends from.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.subjectsList, {
 * 	middleware: [managementAuth(...), managementRateLimit(env.MANAGEMENT_RATE_LIMITER)],
 * 	handler,
 * });
 */
export function managementRateLimit(
	limiter: RateLimiterBinding,
	options: ManagementRateLimitOptions = {},
): Middleware {
	return async (ctx, next) => {
		let caller = ctx.managementCaller;
		let bucket = options.bucket ?? bucketForMethod(ctx.request.method);

		let tenant = await Tenant.findById(ctx.db, caller.tenantId);
		let tier = tenant ? (TIER_LIMITS[tenant.plan_slug] ?? DEFAULT_TIER) : DEFAULT_TIER;

		let adapter = new CloudflareAdapter(limiter, {
			limit: limitFor(tier, bucket),
			window: windowFor(bucket),
		});

		let key = `mgmt:${bucket}:${caller.actor.type}:${caller.actor.id}`;
		let decision = await adapter.consume(key);

		// A limiter that cannot answer lets the request through rather than failing
		// closed, the same choice `ServiceClient`'s own budget spend makes.
		if (isFailure(decision)) return next();

		if (!decision.data.allowed) {
			let body = JSON.stringify({
				type: "https://docs.example.com/errors/rate-limited",
				title: "This tenant's request budget is spent for this window",
				status: 429,
				instance: crypto.randomUUID(),
			});

			return tooManyRequests(decision.data, adapter.window, body, {
				headers: { "Content-Type": "application/problem+json" },
			});
		}

		return await next();
	};
}

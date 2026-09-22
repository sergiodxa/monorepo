/**
 * What every management API resource controller needs to build its own routes:
 * the auth-resolution options `managementAuth` takes, the rate limiter binding
 * `managementRateLimit` spends from, and how to reach the caller's own tenant
 * Durable Object. Bundled once here so a resource area's controller factories
 * share one options shape rather than each declaring its own, and so the next
 * resource area's own controllers reuse it unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HostnameClient } from "@sdxc/hostname";
import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { RequestContext } from "remix/router";

import type Tenant from "~/database/tenant-do";

/** The options a management resource controller's own factory takes. */
export interface ManagementControllerOptions {
	/** The management API's own issuer, `https://api.{PLATFORM_DOMAIN}`. */
	issuer: string;
	/** Resolves a dashboard request's session into the platform member's subject id. */
	resolveDashboardSubjectId: (ctx: RequestContext) => Promise<string | null>;
	/** The `MANAGEMENT_RATE_LIMITER` binding every route's own budget is spent from. */
	limiter: RateLimiterBinding;
	/** Opens a stub for a tenant's Durable Object, given its id. */
	resolveStub: (tenantId: string) => DurableObjectStub<Tenant>;
	/** Opens the platform zone's Cloudflare custom-hostname client, for the domain attach and remove routes. */
	hostnameClient: () => HostnameClient;
}

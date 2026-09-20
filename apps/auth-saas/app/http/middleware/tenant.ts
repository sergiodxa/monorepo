/**
 * Publishes the tenant the Worker already resolved as `ctx.tenant`, and a stub for
 * its Durable Object as `ctx.tenantStub`, reading both off the internal headers
 * `forwardToTenant` sets before handing a request to the tenant router. The tenant
 * is resolved once, on the platform Worker's own hostname lookup, well before this
 * router ever sees the request; these headers are how that resolution crosses in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { badRequest } from "@sdxc/http/response/json";
import { createContextKey } from "remix/router";

import type Tenant from "~/database/tenant-do";

/** Where a resolved tenant's id, region and issuer cross into the tenant router. */
export const TENANT_ID_HEADER = "x-auth-tenant-id";
export const TENANT_REGION_HEADER = "x-auth-tenant-region";
export const TENANT_ISSUER_HEADER = "x-auth-tenant-issuer";

/** The tenant a request was already resolved to, as the tenant router reads it. */
export interface ResolvedTenant {
	id: string;
	region: string;
	issuer: string;
}

export const TenantContext = createContextKey<ResolvedTenant>();
export const TenantStub = createContextKey<DurableObjectStub<Tenant>>();

declare module "remix/router" {
	interface RequestContext {
		/** The tenant this request was already resolved to. */
		tenant: ResolvedTenant;
		/** A stub for the resolved tenant's Durable Object. */
		tenantStub: DurableObjectStub<Tenant>;
	}
}

/**
 * Reads the tenant a request was already resolved to off its internal headers, and
 * publishes both the tenant's own facts and a stub for its Durable Object.
 *
 * @param resolveStub - Opens a stub for a tenant's Durable Object, called per
 * request so a test can hand in a constructed object instead of a binding.
 * @returns The middleware, for the tenant router's chain.
 * @example
 * createRouter({ middleware: [tenant((id) => env.TENANT.getByName(id))] });
 */
export function tenant(resolveStub: (tenantId: string) => DurableObjectStub<Tenant>): Middleware {
	return (ctx, next) => {
		let id = ctx.request.headers.get(TENANT_ID_HEADER);
		let region = ctx.request.headers.get(TENANT_REGION_HEADER);
		let issuer = ctx.request.headers.get(TENANT_ISSUER_HEADER);

		if (!id || !region || !issuer) {
			return badRequest({
				error: "invalid_request",
				error_description: "No tenant was resolved for this request.",
			});
		}

		ctx.set(TenantContext, { id, region, issuer }, { property: "tenant" });
		ctx.set(TenantStub, resolveStub(id), { property: "tenantStub" });

		return next();
	};
}

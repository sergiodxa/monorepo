/**
 * Publishes a stub for the tenant Durable Object a management API request was
 * already resolved to, the same `ctx.tenantStub` property `middleware/tenant.ts`
 * publishes for the tenant router — reused here rather than reinvented, so a
 * route handler reaches `ctx.tenantStub` the same way whichever router it is
 * mounted on. Mounted after `managementAuth`, whose caller this middleware reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import type Tenant from "~/database/tenant-do";

import { TenantStub } from "~/app/http/middleware/tenant";

/**
 * Builds the middleware resolving the caller's own tenant to a Durable Object stub.
 *
 * @param resolveStub - Opens a stub for a tenant's Durable Object, called per
 * request so a test can hand in a constructed object instead of a binding.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.subjectsRead, {
 * 	middleware: [
 * 		managementAuth({ issuer, resolveDashboardSubjectId }),
 * 		managementTenant((id) => env.TENANT.getByName(id)),
 * 	],
 * 	handler,
 * });
 */
export function managementTenant(
	resolveStub: (tenantId: string) => DurableObjectStub<Tenant>,
): Middleware {
	return (ctx, next) => {
		ctx.set(TenantStub, resolveStub(ctx.managementCaller.tenantId), { property: "tenantStub" });
		return next();
	};
}

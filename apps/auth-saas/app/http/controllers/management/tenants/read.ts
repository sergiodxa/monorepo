/**
 * `GET /tenants/:tenantId` — a tenant's own public record: name, slug,
 * issuer, region, status and billing state, leaving out its billing customer
 * id and the payment provider's own subscription linkage as platform-internal
 * detail rather than a fact about the tenant a caller here administers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	mountedMiddleware,
	serializeTenant,
	tenantNotFound,
} from "~/app/http/controllers/management/tenants/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import routes from "~/routes/management";

/**
 * Builds the `tenantRead` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantRead, createTenantReadAction(options));
 */
export function createTenantReadAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantRead, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let tenant = await ctx.models.tenants.find(ctx.managementCaller.tenantId);
			if (!tenant) return tenantNotFound();

			return json(serializeTenant(tenant), { status: 200 });
		},
	});
}

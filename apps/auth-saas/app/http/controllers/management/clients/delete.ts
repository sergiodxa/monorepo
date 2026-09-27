/**
 * `DELETE /tenants/:tenantId/clients/:clientId` — deletes a client and its
 * secrets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { clientIdParam, clientNotFound } from "~/app/http/controllers/management/clients/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `clientsDelete` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsDelete, createClientsDeleteAction(options));
 */
export function createClientsDeleteAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsDelete, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "clients:write");
			if (refused) return refused;

			let clientId = clientIdParam(ctx);

			let result = await ctx.tenantStub.deleteClient({ clientId });
			if (!result.ok) return clientNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

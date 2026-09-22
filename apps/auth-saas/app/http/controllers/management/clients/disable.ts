/**
 * `POST /tenants/:tenantId/clients/:clientId/disable` — marks a client
 * disabled, stopping it from authorizing.
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
 * Builds the `clientsDisable` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsDisable, createClientsDisableAction(options));
 */
export function createClientsDisableAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsDisable, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "clients:write");
			if (refused) return refused;

			let clientId = clientIdParam(ctx);

			let result = await ctx.tenantStub.disableClient({ clientId });
			if (!result.ok) return clientNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

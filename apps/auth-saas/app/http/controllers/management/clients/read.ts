/**
 * `GET /tenants/:tenantId/clients/:clientId` — reads one client's whole
 * record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { clientIdParam, clientNotFound } from "~/app/http/controllers/management/clients/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `clientsRead` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsRead, createClientsReadAction(options));
 */
export function createClientsReadAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsRead, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "clients:write");
			if (refused) return refused;

			let clientId = clientIdParam(ctx);

			let result = await ctx.tenantStub.readClient({ clientId });
			if (!result.ok) return clientNotFound();

			return json(result.client, { status: 200 });
		},
	});
}

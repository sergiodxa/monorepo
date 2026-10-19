/**
 * `POST /tenants/:tenantId/clients/:clientId/disable` — marks a client
 * disabled, stopping it from authorizing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { clientIdParam, clientNotFound } from "~/app/http/controllers/management/clients/shared";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import abilities from "~/app/policies/abilities";
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
			requireAbility(abilities.clients.disable),
		],
		handler: async (ctx) => {
			let clientId = clientIdParam(ctx);

			let result = await ctx.tenantStub.disableClient({ clientId });
			if (!result.ok) return clientNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

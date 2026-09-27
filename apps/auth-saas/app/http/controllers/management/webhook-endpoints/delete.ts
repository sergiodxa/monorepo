/**
 * `DELETE /tenants/:tenantId/webhook-endpoints/:endpointId` — deletes a
 * webhook endpoint outright.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	endpointIdParam,
	endpointNotFound,
} from "~/app/http/controllers/management/webhook-endpoints/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `webhookEndpointsDelete` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.webhookEndpointsDelete, createWebhookEndpointsDeleteAction(options));
 */
export function createWebhookEndpointsDeleteAction(options: ManagementControllerOptions) {
	return createAction(routes.webhookEndpointsDelete, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "webhooks:write");
			if (refused) return refused;

			let endpointId = endpointIdParam(ctx);

			let result = await ctx.tenantStub.deleteWebhookEndpoint({
				endpointId,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return endpointNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

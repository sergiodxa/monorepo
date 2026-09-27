/**
 * `GET /tenants/:tenantId/webhook-endpoints/:endpointId` — reads one webhook
 * endpoint's record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
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
 * Builds the `webhookEndpointsRead` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.webhookEndpointsRead, createWebhookEndpointsReadAction(options));
 */
export function createWebhookEndpointsReadAction(options: ManagementControllerOptions) {
	return createAction(routes.webhookEndpointsRead, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "webhooks:write");
			if (refused) return refused;

			let endpointId = endpointIdParam(ctx);

			let result = await ctx.tenantStub.readWebhookEndpoint({ endpointId });
			if (!result.ok) return endpointNotFound();

			return json(result.endpoint, { status: 200 });
		},
	});
}

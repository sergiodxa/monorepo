/**
 * `POST /tenants/:tenantId/webhook-endpoints/:endpointId/rotate-secret` —
 * mints a successor signing secret and keeps the incumbent live for a
 * rotation's overlap window.
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
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `webhookEndpointsRotateSecret` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(
 * 	routes.webhookEndpointsRotateSecret,
 * 	createWebhookEndpointsRotateSecretAction(options),
 * );
 */
export function createWebhookEndpointsRotateSecretAction(options: ManagementControllerOptions) {
	return createAction(routes.webhookEndpointsRotateSecret, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
			managementIdempotency,
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "webhooks:write");
			if (refused) return refused;

			let endpointId = endpointIdParam(ctx);

			let result = await ctx.tenantStub.rotateEndpointSecret({
				endpointId,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return endpointNotFound();

			return json({ endpoint: result.endpoint, secret: result.secret }, { status: 200 });
		},
	});
}

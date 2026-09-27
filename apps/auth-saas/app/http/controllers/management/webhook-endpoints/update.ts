/**
 * `PATCH /tenants/:tenantId/webhook-endpoints/:endpointId` — applies an RFC 7396
 * merge patch to an endpoint's editable record, so a caller sends only what changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateWebhookEndpointResult } from "~/database/webhook-endpoints";

import {
	endpointIdParam,
	endpointNotFound,
	webhookEndpointValidationFailure,
	webhookEntitlementRequired,
	WEBHOOK_ENDPOINT_BODY_SCHEMA,
	writableWebhookEndpoint,
} from "~/app/http/controllers/management/webhook-endpoints/shared";
import { patchResource } from "~/app/http/lib/merge-patch";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/** Maps every `updateWebhookEndpoint` refusal onto its own `problem+json` response. */
function updateWebhookEndpointFailure(
	result: Exclude<UpdateWebhookEndpointResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return endpointNotFound();
	if (result.reason === "entitlement-required") return webhookEntitlementRequired();
	return webhookEndpointValidationFailure(result);
}

/**
 * Builds the `webhookEndpointsUpdate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.webhookEndpointsUpdate, createWebhookEndpointsUpdateAction(options));
 */
export function createWebhookEndpointsUpdateAction(options: ManagementControllerOptions) {
	return createAction(routes.webhookEndpointsUpdate, {
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

			let current = await ctx.tenantStub.readWebhookEndpoint({ endpointId });
			if (!current.ok) return endpointNotFound();

			let patched = await patchResource(
				ctx.request,
				writableWebhookEndpoint(current.endpoint),
				WEBHOOK_ENDPOINT_BODY_SCHEMA,
			);
			if (!patched.ok) return patched.response;

			let result = await ctx.tenantStub.updateWebhookEndpoint({
				endpointId,
				...patched.next,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return updateWebhookEndpointFailure(result);

			return json(result.endpoint, { status: 200 });
		},
	});
}

/**
 * `PATCH /tenants/:tenantId/webhook-endpoints/:endpointId` — applies an RFC 7396
 * merge patch to an endpoint's editable record, so a caller sends only what changes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateWebhookEndpointResult } from "~/app/models/tenant/webhook-endpoints";

import {
	endpointIdParam,
	endpointNotFound,
	webhookEndpointValidationFailure,
	webhookEntitlementRequired,
	writableWebhookEndpoint,
} from "~/app/http/controllers/management/webhook-endpoints/shared";
import { patchResource } from "~/app/http/merge-patch";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { WEBHOOK_ENDPOINT_BODY_SCHEMA } from "~/app/http/openapi/webhook-endpoints";
import abilities from "~/app/policies/abilities";
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
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
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
			requireAbility(abilities.webhookEndpoints.update),
		],
		handler: async (ctx) => {
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

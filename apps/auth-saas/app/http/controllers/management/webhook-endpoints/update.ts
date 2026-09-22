/**
 * `PATCH /tenants/:tenantId/webhook-endpoints/:endpointId` — replaces an
 * endpoint's whole editable record in one call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateWebhookEndpointResult } from "~/database/webhook-endpoints";

import {
	endpointIdParam,
	endpointNotFound,
	webhookEndpointValidationFailure,
	webhookEntitlementRequired,
} from "~/app/http/controllers/management/webhook-endpoints/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let UpdateWebhookEndpointBodySchema = s.object({
	url: s.string(),
	description: s.string(),
	eventTypes: s.array(s.string()),
});

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
			let refused = requireScope(ctx.managementCaller, "webhooks:write");
			if (refused) return refused;

			let endpointId = endpointIdParam(ctx);

			let parsed = parseBody(
				UpdateWebhookEndpointBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.updateWebhookEndpoint({
				endpointId,
				...parsed.data,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return updateWebhookEndpointFailure(result);

			return json(result.endpoint, { status: 200 });
		},
	});
}

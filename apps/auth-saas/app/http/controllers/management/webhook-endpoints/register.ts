/**
 * `POST /tenants/:tenantId/webhook-endpoints` — registers a receiver for the
 * tenant's directory events, minting its signing secret.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RegisterWebhookEndpointResult } from "~/database/webhook-endpoints";

import {
	webhookEndpointValidationFailure,
	webhookEntitlementRequired,
	WEBHOOK_ENDPOINT_BODY_SCHEMA,
} from "~/app/http/controllers/management/webhook-endpoints/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/** Maps every `registerWebhookEndpoint` refusal onto its own `problem+json` response. */
function registerWebhookEndpointFailure(
	result: Exclude<RegisterWebhookEndpointResult, { ok: true }>,
): Response {
	if (result.reason === "entitlement-required") return webhookEntitlementRequired();
	return webhookEndpointValidationFailure(result);
}

/**
 * Builds the `webhookEndpointsRegister` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.webhookEndpointsRegister, createWebhookEndpointsRegisterAction(options));
 */
export function createWebhookEndpointsRegisterAction(options: ManagementControllerOptions) {
	return createAction(routes.webhookEndpointsRegister, {
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

			let parsed = parseBody(
				WEBHOOK_ENDPOINT_BODY_SCHEMA,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.registerWebhookEndpoint({
				...parsed.data,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return registerWebhookEndpointFailure(result);

			return json({ endpoint: result.endpoint, secret: result.secret }, { status: 201 });
		},
	});
}

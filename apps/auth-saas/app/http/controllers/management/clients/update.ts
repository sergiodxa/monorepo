/**
 * `PATCH /tenants/:tenantId/clients/:clientId` — replaces a client's whole
 * editable record in one call, refusing a change to `kind`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateClientResult } from "~/database/clients";

import {
	clientEntitlementRequired,
	clientIdParam,
	clientNotFound,
	clientRecordValidationFailure,
} from "~/app/http/controllers/management/clients/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let UpdateClientBodySchema = s.object({
	name: s.string(),
	kind: s.enum_(["confidential", "public"] as const),
	redirectUris: s.array(s.string()),
	postLogoutRedirectUris: s.array(s.string()),
	grantTypes: s.array(s.string()),
	responseTypes: s.array(s.string()),
	scopes: s.array(s.string()),
	tokenEndpointAuthMethod: s.enum_(["client_secret_basic", "client_secret_post", "none"] as const),
	requireConsent: s.boolean(),
});

/** Maps every `updateClient` refusal onto its own `problem+json` response. */
function updateClientFailure(result: Exclude<UpdateClientResult, { ok: true }>): Response {
	if (result.reason === "not-found") return clientNotFound();

	if (result.reason === "kind-immutable") {
		return managementProblem("kindImmutable");
	}

	if (result.reason === "entitlement-required") return clientEntitlementRequired();

	return clientRecordValidationFailure(result);
}

/**
 * Builds the `clientsUpdate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsUpdate, createClientsUpdateAction(options));
 */
export function createClientsUpdateAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsUpdate, {
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

			let parsed = parseBody(UpdateClientBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.updateClient({ clientId, ...parsed.data });
			if (!result.ok) return updateClientFailure(result);

			return json(result.client, { status: 200 });
		},
	});
}

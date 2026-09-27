/**
 * `POST /tenants/:tenantId/clients` — registers a relying party, minting its
 * first secret when it is confidential.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RegisterClientResult } from "~/database/clients";

import {
	clientEntitlementRequired,
	clientRecordValidationFailure,
} from "~/app/http/controllers/management/clients/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let RegisterClientBodySchema = s.object({
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

/** Maps every `registerClient` refusal onto its own `problem+json` response. */
function registerClientFailure(result: Exclude<RegisterClientResult, { ok: true }>): Response {
	if (result.reason === "entitlement-required") return clientEntitlementRequired();
	return clientRecordValidationFailure(result);
}

/**
 * Builds the `clientsRegister` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsRegister, createClientsRegisterAction(options));
 */
export function createClientsRegisterAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsRegister, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "clients:write");
			if (refused) return refused;

			let parsed = parseBody(RegisterClientBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.registerClient(parsed.data);
			if (!result.ok) return registerClientFailure(result);

			return json({ client: result.client, secret: result.secret }, { status: 201 });
		},
	});
}

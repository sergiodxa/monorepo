/**
 * `POST /tenants/:tenantId/clients` — registers a relying party, minting its
 * first secret when it is confidential.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RegisterClientResult } from "~/app/models/tenant/clients";

import {
	clientEntitlementRequired,
	clientRecordValidationFailure,
} from "~/app/http/controllers/management/clients/shared";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { CLIENTS_REGISTER } from "~/app/http/openapi/clients";
import { operationInputProblem } from "~/app/http/parse-body";
import abilities from "~/app/policies/abilities";
import routes from "~/routes/management";

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
			managementIdempotency,
			requireAbility(abilities.clients.register),
		],
		handler: async (ctx) => {
			let input = await CLIENTS_REGISTER.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.registerClient(input.data.body);
			if (!result.ok) return registerClientFailure(result);

			return json({ client: result.client, secret: result.secret }, { status: 201 });
		},
	});
}

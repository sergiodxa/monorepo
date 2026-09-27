/**
 * `POST /tenants/:tenantId/clients` — registers a relying party, minting its
 * first secret when it is confidential.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RegisterClientResult } from "~/database/clients";

import {
	clientEntitlementRequired,
	clientRecordValidationFailure,
} from "~/app/http/controllers/management/clients/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { CLIENTS_REGISTER } from "~/app/http/openapi/clients";
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
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "clients:write");
			if (refused) return refused;

			let input = await CLIENTS_REGISTER.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.registerClient(input.data.body);
			if (!result.ok) return registerClientFailure(result);

			return json({ client: result.client, secret: result.secret }, { status: 201 });
		},
	});
}

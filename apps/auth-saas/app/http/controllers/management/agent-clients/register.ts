/**
 * `POST /tenants/:tenantId/agent-clients` — registers a machine credential: an
 * OAuth client of the platform tenant, granted only the client_credentials
 * grant, bound at registration to the one tenant it may reach.
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
import { AGENT_CLIENTS_REGISTER } from "~/app/http/openapi/agent-clients";
import { platformTenantStub } from "~/app/lib/platform-tenant";
import AgentClientBinding from "~/app/models/agent-client-binding";
import { seedManagementScopes } from "~/app/services/management-scopes";
import routes from "~/routes/management";

/** Maps every `registerClient` refusal onto its own `problem+json` response. */
function registerAgentClientFailure(result: Exclude<RegisterClientResult, { ok: true }>): Response {
	if (result.reason === "entitlement-required") return clientEntitlementRequired();
	return clientRecordValidationFailure(result);
}

/**
 * Builds the `agentClientsRegister` action.
 *
 * @param options - The auth and rate-limit options every management resource
 * controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.agentClientsRegister, createAgentClientsRegisterAction(options));
 */
export function createAgentClientsRegisterAction(options: ManagementControllerOptions) {
	return createAction(routes.agentClientsRegister, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementRateLimit(options.limiter, { bucket: "write" }),
			managementIdempotency,
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "clients:write");
			if (refused) return refused;

			let input = await AGENT_CLIENTS_REGISTER.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let platform = platformTenantStub();

			await seedManagementScopes(platform);

			let result = await platform.registerClient({
				name: input.data.body.name,
				kind: "confidential",
				redirectUris: [],
				postLogoutRedirectUris: [],
				grantTypes: ["client_credentials"],
				responseTypes: [],
				scopes: input.data.body.scopes,
				tokenEndpointAuthMethod: "client_secret_basic",
				requireConsent: false,
			});
			if (!result.ok) return registerAgentClientFailure(result);
			if (result.secret === null) {
				throw new Error("a confidential client registered with no secret");
			}

			await AgentClientBinding.create(ctx.db, {
				clientId: result.client.id,
				tenantId: ctx.managementCaller.tenantId,
			});

			return json({ clientId: result.client.id, secret: result.secret }, { status: 201 });
		},
	});
}

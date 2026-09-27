/**
 * `POST /tenants/:tenantId/clients/:clientId/rotate-secret` — mints a
 * successor secret and opens the overlap window on the incumbent, so a
 * caller has both to hand off between before the incumbent stops verifying.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RotateClientSecretResult } from "~/database/clients";

import { clientIdParam, clientNotFound } from "~/app/http/controllers/management/clients/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { CLIENTS_ROTATE_SECRET } from "~/app/http/openapi/clients";
import routes from "~/routes/management";

/** Maps every `rotateClientSecret` refusal onto its own `problem+json` response. */
function rotateClientSecretFailure(
	result: Exclude<RotateClientSecretResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return clientNotFound();

	if (result.reason === "not-confidential") {
		return managementProblem("notConfidential");
	}

	return managementProblem("tooManyLiveSecrets");
}

/**
 * Builds the `clientsRotateSecret` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsRotateSecret, createClientsRotateSecretAction(options));
 */
export function createClientsRotateSecretAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsRotateSecret, {
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

			let clientId = clientIdParam(ctx);

			let input = await CLIENTS_ROTATE_SECRET.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.rotateClientSecret({
				clientId,
				windowDays: input.data.body?.windowDays,
			});
			if (!result.ok) return rotateClientSecretFailure(result);

			return json(
				{
					secretId: result.secretId,
					secret: result.secret,
					incumbentExpiresAt: result.incumbentExpiresAt,
				},
				{ status: 200 },
			);
		},
	});
}

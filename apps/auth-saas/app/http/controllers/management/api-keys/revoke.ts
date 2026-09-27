/**
 * `POST /tenants/:tenantId/api-keys/:keyId/revoke` — revokes a key at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { apiKeyNotFound, keyIdParam } from "~/app/http/controllers/management/api-keys/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { API_KEYS_REVOKE } from "~/app/http/openapi/api-keys";
import routes from "~/routes/management";

/**
 * Builds the `apiKeysRevoke` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.apiKeysRevoke, createApiKeysRevokeAction(options));
 */
export function createApiKeysRevokeAction(options: ManagementControllerOptions) {
	return createAction(routes.apiKeysRevoke, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "keys:write");
			if (refused) return refused;

			let keyId = keyIdParam(ctx);

			let input = await API_KEYS_REVOKE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.revokeApiKey({
				keyId,
				reason: input.data.body.reason,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return apiKeyNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

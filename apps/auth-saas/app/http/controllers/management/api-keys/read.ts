/**
 * `GET /tenants/:tenantId/api-keys/:keyId` — reads one API key's own record.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { apiKeyNotFound, keyIdParam } from "~/app/http/controllers/management/api-keys/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `apiKeysRead` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.apiKeysRead, createApiKeysReadAction(options));
 */
export function createApiKeysReadAction(options: ManagementControllerOptions) {
	return createAction(routes.apiKeysRead, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "keys:write");
			if (refused) return refused;

			let keyId = keyIdParam(ctx);

			let result = await ctx.tenantStub.readApiKey({ keyId });
			if (!result.ok) return apiKeyNotFound();

			return json(result.key, { status: 200 });
		},
	});
}

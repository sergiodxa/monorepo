/**
 * `GET /tenants/:tenantId/roles` — every role held at a scope, system roles
 * first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let RolesListQuerySchema = s.object({ scope: s.string() });

/**
 * Builds the `rolesList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.rolesList, createRolesListAction(options));
 */
export function createRolesListAction(options: ManagementControllerOptions) {
	return createAction(routes.rolesList, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let query = parseBody(RolesListQuerySchema, Object.fromEntries(ctx.url.searchParams));
			if (!query.ok) return query.response;

			let result = await ctx.tenantStub.listRoles({ scope: query.data.scope });

			return json(result.roles, { status: 200 });
		},
	});
}

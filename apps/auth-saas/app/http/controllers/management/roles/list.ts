/**
 * `GET /tenants/:tenantId/roles` — every role held at a scope, system roles
 * first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { ROLES_LIST } from "~/app/http/openapi/roles";
import routes from "~/routes/management";

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

			let input = await ROLES_LIST.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.listRoles({ scope: input.data.query.scope });

			return json(result.roles, { status: 200 });
		},
	});
}

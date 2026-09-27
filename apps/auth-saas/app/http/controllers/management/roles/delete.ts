/**
 * `DELETE /tenants/:tenantId/roles/:roleId` — deletes a custom role,
 * reassigning every current holder to another role in the same call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { DeleteRoleResult } from "~/database/roles";

import {
	roleIdParam,
	roleNotFound,
	rolesEntitlementRequired,
} from "~/app/http/controllers/management/roles/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { ROLES_DELETE } from "~/app/http/openapi/roles";
import routes from "~/routes/management";

/** Maps every `deleteRole` refusal onto its own `problem+json` response. */
function deleteRoleFailure(result: Exclude<DeleteRoleResult, { ok: true }>): Response {
	if (result.reason === "not-found") return roleNotFound();
	if (result.reason === "entitlement-required") return rolesEntitlementRequired();

	if (result.reason === "invalid-reassignment") {
		return managementProblem("invalidReassignment");
	}

	return managementProblem("systemRole", {
		detail: "A system role may not be deleted.",
	});
}

/**
 * Builds the `rolesDelete` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.rolesDelete, createRolesDeleteAction(options));
 */
export function createRolesDeleteAction(options: ManagementControllerOptions) {
	return createAction(routes.rolesDelete, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let roleId = roleIdParam(ctx);

			let input = await ROLES_DELETE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.deleteRole({
				roleId,
				scope: input.data.query.scope,
				reassignTo: input.data.query.reassignTo,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return deleteRoleFailure(result);

			return json({ reassigned: result.reassigned }, { status: 200 });
		},
	});
}

/**
 * `PATCH /tenants/:tenantId/roles/:roleId` — updates a custom role's name
 * and description, leaving any field left out exactly as it stood.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateRoleResult } from "~/app/models/tenant/roles";

import {
	roleIdParam,
	roleNotFound,
	rolesEntitlementRequired,
} from "~/app/http/controllers/management/roles/shared";
import { readPatchBody } from "~/app/http/merge-patch";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { ROLE_PATCH } from "~/app/http/openapi/roles";
import { managementProblem } from "~/app/http/problem";
import abilities from "~/app/policies/abilities";
import routes from "~/routes/management";

/** Maps every `updateRole` refusal onto its own `problem+json` response. */
function updateRoleFailure(result: Exclude<UpdateRoleResult, { ok: true }>): Response {
	if (result.reason === "not-found") return roleNotFound();
	if (result.reason === "entitlement-required") return rolesEntitlementRequired();

	return managementProblem("systemRole", {
		detail: "A system role's name and description may not be changed.",
	});
}

/**
 * Builds the `rolesUpdate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.rolesUpdate, createRolesUpdateAction(options));
 */
export function createRolesUpdateAction(options: ManagementControllerOptions) {
	return createAction(routes.rolesUpdate, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
			requireAbility(abilities.roles.update),
		],
		handler: async (ctx) => {
			let roleId = roleIdParam(ctx);

			let parsed = await readPatchBody(ctx.request, ROLE_PATCH);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.updateRole({
				roleId,
				...parsed.data,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return updateRoleFailure(result);

			return json(result.role, { status: 200 });
		},
	});
}

/**
 * `PUT /tenants/:tenantId/roles/:roleId/permissions` — replaces a custom
 * role's whole granted set in one call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { SetRolePermissionsResult } from "~/database/roles";

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
import { ROLES_SET_PERMISSIONS } from "~/app/http/openapi/roles";
import routes from "~/routes/management";

/** Maps every `setRolePermissions` refusal onto its own `problem+json` response. */
function setRolePermissionsFailure(
	result: Exclude<SetRolePermissionsResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return roleNotFound();
	if (result.reason === "entitlement-required") return rolesEntitlementRequired();

	if (result.reason === "unknown-permission") {
		return managementProblem("unknownPermission", {
			detail: `"${result.key}" has not been declared for this tenant.`,
		});
	}

	if (result.reason === "too-large") {
		return managementProblem("permissionSetTooLarge", {
			detail: `The serialized set is ${result.size} bytes; the cap is ${result.cap}.`,
		});
	}

	return managementProblem("systemRole", {
		detail: "A system role's grant is fixed and may not be set.",
	});
}

/**
 * Builds the `rolesSetPermissions` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.rolesSetPermissions, createRolesSetPermissionsAction(options));
 */
export function createRolesSetPermissionsAction(options: ManagementControllerOptions) {
	return createAction(routes.rolesSetPermissions, {
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

			let input = await ROLES_SET_PERMISSIONS.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.setRolePermissions({
				roleId,
				permissionKeys: input.data.body.permissionKeys,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return setRolePermissionsFailure(result);

			return json({ permissionKeys: result.permissionKeys }, { status: 200 });
		},
	});
}

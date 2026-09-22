/**
 * `PUT /tenants/:tenantId/roles/:roleId/permissions` — replaces a custom
 * role's whole granted set in one call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { SetRolePermissionsResult } from "~/database/roles";

import {
	roleIdParam,
	roleNotFound,
	rolesEntitlementRequired,
} from "~/app/http/controllers/management/roles/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let SetRolePermissionsBodySchema = s.object({ permissionKeys: s.array(s.string()) });

/** Maps every `setRolePermissions` refusal onto its own `problem+json` response. */
function setRolePermissionsFailure(
	result: Exclude<SetRolePermissionsResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return roleNotFound();
	if (result.reason === "entitlement-required") return rolesEntitlementRequired();

	if (result.reason === "unknown-permission") {
		return problem({
			type: "https://docs.example.com/errors/unknown-permission",
			title: "One of the given permission keys has no declared definition",
			status: 400,
			detail: `"${result.key}" has not been declared for this tenant.`,
		});
	}

	if (result.reason === "too-large") {
		return problem({
			type: "https://docs.example.com/errors/permission-set-too-large",
			title: "This set of permission keys exceeds what a role may grant",
			status: 400,
			detail: `The serialized set is ${result.size} bytes; the cap is ${result.cap}.`,
		});
	}

	return problem({
		type: "https://docs.example.com/errors/system-role",
		title: "A system role's grant is fixed and may not be set",
		status: 409,
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
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let roleId = roleIdParam(ctx);

			let parsed = parseBody(
				SetRolePermissionsBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.setRolePermissions({
				roleId,
				permissionKeys: parsed.data.permissionKeys,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return setRolePermissionsFailure(result);

			return json({ permissionKeys: result.permissionKeys }, { status: 200 });
		},
	});
}

/**
 * `PATCH /tenants/:tenantId/roles/:roleId` — updates a custom role's name
 * and description, leaving any field left out exactly as it stood.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateRoleResult } from "~/database/roles";

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

let UpdateRoleBodySchema = s.object({
	scope: s.string(),
	name: s.optional(s.string()),
	description: s.optional(s.string()),
});

/** Maps every `updateRole` refusal onto its own `problem+json` response. */
function updateRoleFailure(result: Exclude<UpdateRoleResult, { ok: true }>): Response {
	if (result.reason === "not-found") return roleNotFound();
	if (result.reason === "entitlement-required") return rolesEntitlementRequired();

	return problem({
		type: "https://docs.example.com/errors/system-role",
		title: "A system role's name and description may not be changed",
		status: 409,
	});
}

/**
 * Builds the `rolesUpdate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
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
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let roleId = roleIdParam(ctx);

			let parsed = parseBody(UpdateRoleBodySchema, await ctx.request.json().catch(() => null));
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

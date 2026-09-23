/**
 * `POST /tenants/:tenantId/roles` — defines a tenant's own role at a scope,
 * beyond the three the platform reserves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { DefineRoleResult } from "~/database/roles";

import { rolesEntitlementRequired } from "~/app/http/controllers/management/roles/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let DefineRoleBodySchema = s.object({
	scope: s.string(),
	key: s.string(),
	name: s.string(),
	description: s.string(),
});

/** Maps every `defineRole` refusal onto its own `problem+json` response. */
function defineRoleFailure(result: Exclude<DefineRoleResult, { ok: true }>): Response {
	if (result.reason === "entitlement-required") return rolesEntitlementRequired();

	if (result.reason === "reserved-key") {
		return managementProblem("reservedKey", {
			detail: "This key is reserved for one of the platform's own system roles.",
		});
	}

	return managementProblem("duplicateRole");
}

/**
 * Builds the `rolesDefine` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.rolesDefine, createRolesDefineAction(options));
 */
export function createRolesDefineAction(options: ManagementControllerOptions) {
	return createAction(routes.rolesDefine, {
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

			let parsed = parseBody(DefineRoleBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.defineRole({
				...parsed.data,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return defineRoleFailure(result);

			return json(result.role, { status: 201 });
		},
	});
}

/**
 * `POST /tenants/:tenantId/roles` — defines a tenant's own role at a scope,
 * beyond the three the platform reserves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { DefineRoleResult } from "~/database/roles";

import { rolesEntitlementRequired } from "~/app/http/controllers/management/roles/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementIdempotency } from "~/app/http/middleware/management-idempotency";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { ROLES_DEFINE } from "~/app/http/openapi/roles";
import routes from "~/routes/management";

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
			managementIdempotency,
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "members:write");
			if (refused) return refused;

			let input = await ROLES_DEFINE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.defineRole({
				...input.data.body,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return defineRoleFailure(result);

			return json(result.role, { status: 201 });
		},
	});
}

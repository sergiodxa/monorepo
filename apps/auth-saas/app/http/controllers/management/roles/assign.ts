/**
 * `POST /tenants/:tenantId/subjects/:subjectId/roles` — assigns a role to a
 * subject at a scope, replacing any role already held there.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { AssignRoleResult } from "~/database/roles";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SUBJECT_ROLES_ASSIGN } from "~/app/http/openapi/roles";
import routes from "~/routes/management";

/** Maps every `assignRole` refusal onto its own `problem+json` response. */
function assignRoleFailure(result: Exclude<AssignRoleResult, { ok: true }>): Response {
	if (result.reason === "subject-not-found") return subjectNotFound();

	if (result.reason === "role-not-found") {
		return managementProblem("notFound", {
			detail: "No such role exists at this scope.",
		});
	}

	if (result.reason === "organization-not-found") {
		return managementProblem("notFound", {
			detail: "No such organization exists.",
		});
	}

	if (result.reason === "not-member") {
		return managementProblem("notMember");
	}

	return managementProblem("lastOwner");
}

/**
 * Builds the `subjectRolesAssign` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectRolesAssign, createSubjectRolesAssignAction(options));
 */
export function createSubjectRolesAssignAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectRolesAssign, {
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

			let subjectId = subjectIdParam(ctx);

			let input = await SUBJECT_ROLES_ASSIGN.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.assignRole({
				subjectId,
				...input.data.body,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return assignRoleFailure(result);

			return json({ roleKey: result.roleKey }, { status: 200 });
		},
	});
}

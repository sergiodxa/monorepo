/**
 * `GET /tenants/:tenantId/subjects/:subjectId/access` — the role a subject
 * holds at a scope and its resolved permission set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { subjectIdParam } from "~/app/http/controllers/management/subjects/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SUBJECT_ACCESS_READ } from "~/app/http/openapi/roles";
import routes from "~/routes/management";

/**
 * Builds the `subjectAccessRead` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectAccessRead, createSubjectAccessReadAction(options));
 */
export function createSubjectAccessReadAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectAccessRead, {
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

			let subjectId = subjectIdParam(ctx);

			let input = await SUBJECT_ACCESS_READ.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.describeSubjectAccess({
				subjectId,
				scope: input.data.query.scope,
			});

			let { cost: _cost, ...body } = result;
			return json(body, { status: 200 });
		},
	});
}

/**
 * `POST /tenants/:tenantId/subjects/:subjectId/block` — blocks a subject and
 * revokes every session it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SUBJECTS_BLOCK } from "~/app/http/openapi/subjects";
import routes from "~/routes/management";

/**
 * Builds the `subjectsBlock` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsBlock, createSubjectsBlockAction(options));
 */
export function createSubjectsBlockAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsBlock, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let input = await SUBJECTS_BLOCK.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.blockSubject({ subjectId, reason: input.data.body.reason });
			if (!result.ok) return subjectNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

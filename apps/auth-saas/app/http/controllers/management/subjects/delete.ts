/**
 * `DELETE /tenants/:tenantId/subjects/:subjectId` — deletes a subject, its
 * identifiers, its credentials and its attributes, and retires its id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `subjectsDelete` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsDelete, createSubjectsDeleteAction(options));
 */
export function createSubjectsDeleteAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsDelete, {
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

			let result = await ctx.tenantStub.deleteSubject({ subjectId });
			if (!result.ok) return subjectNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

/**
 * `POST /tenants/:tenantId/subjects/:subjectId/unblock` — restores a blocked
 * subject to active.
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
 * Builds the `subjectsUnblock` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsUnblock, createSubjectsUnblockAction(options));
 */
export function createSubjectsUnblockAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsUnblock, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let result = await ctx.tenantStub.unblockSubject({ subjectId });
			if (!result.ok) return subjectNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

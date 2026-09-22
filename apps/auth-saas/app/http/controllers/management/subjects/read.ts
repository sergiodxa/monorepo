/**
 * `GET /tenants/:tenantId/subjects/:subjectId` — reads everything one account
 * screen renders for a subject, assembled by the tenant object's own
 * `describeSubject`, second-factor state and all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `subjectsRead` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsRead, createSubjectsReadAction(options));
 */
export function createSubjectsReadAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsRead, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "subjects:read");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let result = await ctx.tenantStub.describeSubject({ subjectId, audience: { kind: "admin" } });
			if (!result.ok) return subjectNotFound();

			let { cost: _cost, ok: _ok, ...body } = result;
			return json(body, { status: 200 });
		},
	});
}

/**
 * `GET /tenants/:tenantId/subjects/:subjectId/access` — the role a subject
 * holds at a scope and its resolved permission set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { subjectIdParam } from "~/app/http/controllers/management/subjects/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let SubjectAccessQuerySchema = s.object({ scope: s.string() });

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
			let refused = requireScope(ctx.managementCaller, "members:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let query = parseBody(SubjectAccessQuerySchema, Object.fromEntries(ctx.url.searchParams));
			if (!query.ok) return query.response;

			let result = await ctx.tenantStub.describeSubjectAccess({
				subjectId,
				scope: query.data.scope,
			});

			let { cost: _cost, ...body } = result;
			return json(body, { status: 200 });
		},
	});
}

/**
 * `POST /tenants/:tenantId/subjects/:subjectId/block` — blocks a subject and
 * revokes every session it holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { subjectIdParam, subjectNotFound } from "~/app/http/controllers/management/subjects/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let BlockSubjectBodySchema = s.object({ reason: s.string() });

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

			let parsed = parseBody(BlockSubjectBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.blockSubject({ subjectId, reason: parsed.data.reason });
			if (!result.ok) return subjectNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

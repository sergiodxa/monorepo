/**
 * `GET /tenants/:tenantId/subjects` — a keyset page of the tenant's subjects,
 * newest first, optionally filtered by status.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementPaging } from "~/app/http/lib/management-pagination";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/** The one query parameter besides paging this list route reads. */
function statusFilter(searchParams: URLSearchParams): "active" | "blocked" | undefined {
	let value = searchParams.get("status");
	return value === "active" || value === "blocked" ? value : undefined;
}

/**
 * Builds the `subjectsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectsList, createSubjectsListAction(options));
 */
export function createSubjectsListAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectsList, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "subjects:read");
			if (refused) return refused;

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return managementProblem("invalidRequest");
			}

			let result = await ctx.tenantStub.listSubjects({
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
				status: statusFilter(ctx.url.searchParams),
			});

			if (!result.ok) {
				return managementProblem("badCursor");
			}

			let headers = managementPaging.paginate(
				new Headers(),
				{ items: result.subjects, cursors: result.cursors },
				{ url: ctx.url },
			);

			return json(result.subjects, { status: 200, headers });
		},
	});
}

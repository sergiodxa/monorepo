/**
 * `GET /tenants/:tenantId/api-keys` — a keyset page of one of the tenant's
 * own end users' API keys, newest first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementPaging } from "~/app/http/lib/management-pagination";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { API_KEYS_LIST } from "~/app/http/openapi/api-keys";
import routes from "~/routes/management";

/**
 * Builds the `apiKeysList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.apiKeysList, createApiKeysListAction(options));
 */
export function createApiKeysListAction(options: ManagementControllerOptions) {
	return createAction(routes.apiKeysList, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "keys:write");
			if (refused) return refused;

			let input = await API_KEYS_LIST.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return managementProblem("invalidRequest");
			}

			let result = await ctx.tenantStub.listApiKeys({
				subjectId: input.data.query.subjectId,
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
			});

			if (!result.ok) {
				return managementProblem("badCursor");
			}

			let headers = managementPaging.paginate(
				new Headers(),
				{ items: result.keys, cursors: result.cursors },
				{ url: ctx.url },
			);

			return json(result.keys, { status: 200, headers });
		},
	});
}

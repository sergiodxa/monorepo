/**
 * `GET /tenants/:tenantId/clients` — a keyset page of the tenant's clients,
 * newest first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { managementPaging } from "~/app/http/lib/management-pagination";
import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/**
 * Builds the `clientsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsList, createClientsListAction(options));
 */
export function createClientsListAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsList, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "clients:write");
			if (refused) return refused;

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return problem({
					type: "https://docs.example.com/errors/invalid-request",
					title: "The paging parameters are not valid",
					status: 400,
				});
			}

			let result = await ctx.tenantStub.listClients({
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
			});

			if (!result.ok) {
				return problem({
					type: "https://docs.example.com/errors/bad-cursor",
					title: "The given cursor no longer matches this ordering",
					status: 400,
				});
			}

			let headers = managementPaging.paginate(
				new Headers(),
				{ items: result.clients, cursors: result.cursors },
				{ url: ctx.url },
			);

			return json(result.clients, { status: 200, headers });
		},
	});
}

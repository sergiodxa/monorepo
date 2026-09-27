/**
 * `GET /tenants/:tenantId/audit-events` — a keyset page of the tenant's own
 * audit log over a required time window, newest first, with optional filters
 * by action, actor and target.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ReadAuditPageResult } from "~/database/audit-events";
import type { WithCost } from "~/database/tenant-do";

import { managementPaging } from "~/app/http/lib/management-pagination";
import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { AUDIT_EVENTS_LIST } from "~/app/http/openapi/audit";
import routes from "~/routes/management";

/**
 * Builds the `auditEventsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.auditEventsList, createAuditEventsListAction(options));
 */
export function createAuditEventsListAction(options: ManagementControllerOptions) {
	return createAction(routes.auditEventsList, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "read" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "audit:read");
			if (refused) return refused;

			let input = await AUDIT_EVENTS_LIST.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);
			let query = input.data.query;

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return managementProblem("invalidRequest");
			}

			let read = await ctx.tenantStub.readAuditPage({
				from: query.from,
				to: query.to,
				action: query.action,
				actorId: query.actor_id,
				targetId: query.target_id,
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
			});

			// Named to the same union `readAuditPage` itself answers with, so both
			// its success and its bad-cursor branch stay reachable through the stub.
			let result = read as WithCost<ReadAuditPageResult>;

			if (!result.ok) {
				return managementProblem("badCursor");
			}

			let headers = managementPaging.paginate(
				new Headers(),
				{ items: result.events, cursors: result.cursors },
				{ url: ctx.url },
			);

			return json(result.events, { status: 200, headers });
		},
	});
}

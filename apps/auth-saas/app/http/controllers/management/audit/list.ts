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
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { ReadAuditPageResult } from "~/database/audit-events";
import type { WithCost } from "~/database/tenant-do";

import { managementPaging } from "~/app/http/lib/management-pagination";
import { parseBody } from "~/app/http/lib/parse-body";
import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let AuditEventsListQuerySchema = s.object({
	from: coerce.number(),
	to: coerce.number(),
	action: s.optional(s.string()),
	actor_id: s.optional(s.string()),
	target_id: s.optional(s.string()),
});

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
			let refused = requireScope(ctx.managementCaller, "audit:read");
			if (refused) return refused;

			let query = parseBody(AuditEventsListQuerySchema, Object.fromEntries(ctx.url.searchParams));
			if (!query.ok) return query.response;

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return problem({
					type: "https://docs.example.com/errors/invalid-request",
					title: "The paging parameters are not valid",
					status: 400,
				});
			}

			let read = await ctx.tenantStub.readAuditPage({
				from: query.data.from,
				to: query.data.to,
				action: query.data.action,
				actorId: query.data.actor_id,
				targetId: query.data.target_id,
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
			});

			// Named to the same union `readAuditPage` itself answers with, so both
			// its success and its bad-cursor branch stay reachable through the stub.
			let result = read as WithCost<ReadAuditPageResult>;

			if (!result.ok) {
				return problem({
					type: "https://docs.example.com/errors/bad-cursor",
					title: "The given cursor no longer matches this ordering",
					status: 400,
				});
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

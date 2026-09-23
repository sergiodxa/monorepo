/**
 * The OAuth consent grants a subject has agreed to: `GET .../grants` pages
 * them, most recently agreed to first, and `POST .../grants/:clientId/revoke`
 * ends the subject's standing decision for one client. Defining a grant has
 * no route of its own — a grant is created by a subject consenting at
 * `/authorize`, never administratively.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import { subjectIdParam } from "~/app/http/controllers/management/subjects/shared";
import { managementPaging } from "~/app/http/lib/management-pagination";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

function mountedMiddleware(options: ManagementControllerOptions, bucket: "read" | "write") {
	return [
		managementAuth({
			issuer: options.issuer,
			resolveDashboardSubjectId: options.resolveDashboardSubjectId,
		}),
		managementTenant(options.resolveStub),
		managementRateLimit(options.limiter, { bucket }),
	];
}

/**
 * Builds the `subjectGrantsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectGrantsList, createSubjectGrantsListAction(options));
 */
export function createSubjectGrantsListAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectGrantsList, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "subjects:read");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return managementProblem("invalidRequest");
			}

			let result = await ctx.tenantStub.listGrants({
				subjectId,
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
			});

			if (!result.ok) {
				return managementProblem("badCursor");
			}

			let headers = managementPaging.paginate(
				new Headers(),
				{ items: result.grants, cursors: result.cursors },
				{ url: ctx.url },
			);

			return json(result.grants, { status: 200, headers });
		},
	});
}

/** Parses and requires the `:clientId` path param the revoke route matches. */
function clientIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ clientId: s.string() }), ctx.params).clientId;
}

/** A grant named in the revoke route's own path that this subject does not hold for this client. */
function grantNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such grant exists for this subject and client.",
	});
}

/**
 * Builds the `subjectGrantsRevoke` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.subjectGrantsRevoke, createSubjectGrantsRevokeAction(options));
 */
export function createSubjectGrantsRevokeAction(options: ManagementControllerOptions) {
	return createAction(routes.subjectGrantsRevoke, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "subjects:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);
			let clientId = clientIdParam(ctx);

			let result = await ctx.tenantStub.revokeGrant({ subjectId, clientId });
			if (result.kind === "unknown") return grantNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

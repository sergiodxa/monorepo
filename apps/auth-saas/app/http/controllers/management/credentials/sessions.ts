/**
 * A subject's own live sessions: `GET .../sessions` pages them, `DELETE
 * .../sessions/:sessionId` ends one, and `POST .../sessions/revoke-all` ends
 * every one it holds in a single call. A session id is a TypeID, Crockford
 * base32 with an underscore separator, an alphabet with no `.` in it, so it
 * travels safely as a path segment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	sessionIdParam,
	sessionNotFound,
} from "~/app/http/controllers/management/credentials/shared";
import { subjectIdParam } from "~/app/http/controllers/management/subjects/shared";
import { managementPaging } from "~/app/http/lib/management-pagination";
import { parseBody } from "~/app/http/lib/parse-body";
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
 * Builds the `sessionsList` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.sessionsList, createSessionsListAction(options));
 */
export function createSessionsListAction(options: ManagementControllerOptions) {
	return createAction(routes.sessionsList, {
		middleware: mountedMiddleware(options, "read"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "sessions:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return managementProblem("invalidRequest");
			}

			let result = await ctx.tenantStub.listSubjectSessions({
				subjectId,
				// A management caller holds no session of its own to flag as current, so
				// every row in the page answers `isCurrent: false`.
				callerSessionId: "",
				cursor: paging.data.cursor,
				limit: paging.data.perPage,
			});

			if (!result.ok) {
				return managementProblem("badCursor");
			}

			let headers = managementPaging.paginate(
				new Headers(),
				{ items: result.sessions, cursors: result.cursors },
				{ url: ctx.url },
			);

			return json(result.sessions, { status: 200, headers });
		},
	});
}

let RevokeSessionQuerySchema = s.object({ reason: s.string() });

/**
 * Builds the `sessionsRevoke` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.sessionsRevoke, createSessionsRevokeAction(options));
 */
export function createSessionsRevokeAction(options: ManagementControllerOptions) {
	return createAction(routes.sessionsRevoke, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "sessions:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);
			let sessionId = sessionIdParam(ctx);

			let query = parseBody(RevokeSessionQuerySchema, Object.fromEntries(ctx.url.searchParams));
			if (!query.ok) return query.response;

			let result = await ctx.tenantStub.revokeSession({
				subjectId,
				sessionId,
				reason: query.data.reason,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return sessionNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

let RevokeAllSessionsBodySchema = s.object({ reason: s.string() });

/**
 * Builds the `sessionsRevokeAll` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.sessionsRevokeAll, createSessionsRevokeAllAction(options));
 */
export function createSessionsRevokeAllAction(options: ManagementControllerOptions) {
	return createAction(routes.sessionsRevokeAll, {
		middleware: mountedMiddleware(options, "write"),
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "sessions:write");
			if (refused) return refused;

			let subjectId = subjectIdParam(ctx);

			let parsed = parseBody(
				RevokeAllSessionsBodySchema,
				await ctx.request.json().catch(() => null),
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.revokeSubjectSessions({
				subjectId,
				reason: parsed.data.reason,
				actor: ctx.managementCaller.actor,
			});

			return json({ revoked: result.revoked }, { status: 200 });
		},
	});
}

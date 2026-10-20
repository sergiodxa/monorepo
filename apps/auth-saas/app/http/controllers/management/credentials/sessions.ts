/**
 * A subject's own live sessions: `GET .../sessions` pages them, `DELETE
 * .../sessions/:sessionId` ends one, and `POST .../sessions/revoke-all` ends every
 * one it holds in a single call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";

import {
	sessionIdParam,
	sessionNotFound,
} from "~/app/http/controllers/management/credentials/shared";
import { subjectIdParam } from "~/app/http/controllers/management/subjects/shared";
import { managementPaging } from "~/app/http/management-pagination";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { SESSIONS_REVOKE, SESSIONS_REVOKE_ALL } from "~/app/http/openapi/credentials";
import { operationInputProblem } from "~/app/http/parse-body";
import { managementProblem } from "~/app/http/problem";
import abilities from "~/app/policies/abilities";
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
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.sessionsList, createSessionsListAction(options));
 */
export function createSessionsListAction(options: ManagementControllerOptions) {
	return createAction(routes.sessionsList, {
		middleware: [
			...mountedMiddleware(options, "read"),
			requireAbility(abilities.subjects.sessions.list),
		],
		handler: async (ctx) => {
			let subjectId = subjectIdParam(ctx);

			let paging = managementPaging.parse(ctx.url.searchParams);
			if (isFailure(paging)) {
				return managementProblem("invalidRequest");
			}

			let result = await ctx.tenantStub.listSubjectSessions({
				subjectId,

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

/**
 * Builds the `sessionsRevoke` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.sessionsRevoke, createSessionsRevokeAction(options));
 */
export function createSessionsRevokeAction(options: ManagementControllerOptions) {
	return createAction(routes.sessionsRevoke, {
		middleware: [
			...mountedMiddleware(options, "write"),
			requireAbility(abilities.subjects.sessions.revoke),
		],
		handler: async (ctx) => {
			let subjectId = subjectIdParam(ctx);
			let sessionId = sessionIdParam(ctx);

			let input = await SESSIONS_REVOKE.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.revokeSession({
				subjectId,
				sessionId,
				reason: input.data.query.reason,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return sessionNotFound();

			return new Response(null, { status: 204 });
		},
	});
}

/**
 * Builds the `sessionsRevokeAll` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.sessionsRevokeAll, createSessionsRevokeAllAction(options));
 */
export function createSessionsRevokeAllAction(options: ManagementControllerOptions) {
	return createAction(routes.sessionsRevokeAll, {
		middleware: [
			...mountedMiddleware(options, "write"),
			requireAbility(abilities.subjects.sessions.revokeAll),
		],
		handler: async (ctx) => {
			let subjectId = subjectIdParam(ctx);

			let input = await SESSIONS_REVOKE_ALL.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.revokeSubjectSessions({
				subjectId,
				reason: input.data.body.reason,
				actor: ctx.managementCaller.actor,
			});

			return json({ revoked: result.revoked }, { status: 200 });
		},
	});
}

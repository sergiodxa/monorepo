/**
 * Builds the management API router's fetch-router: the administrative surface
 * served on `api.{PLATFORM_DOMAIN}`. This pass wires only its shared plumbing and
 * the token endpoint; every resource route (subjects, clients, audit events, and
 * the rest of the ADR's table) is a later pass's own addition to `routes/management.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";

import { log } from "@sdxc/logger/middleware";
import { env } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";

import token from "~/app/http/controllers/management/token";
import notFound from "~/app/http/controllers/not-found";
import { apiVersioning } from "~/app/http/lib/api-version";
import { database } from "~/app/http/middleware/database";
import trailingSlash from "~/app/http/middleware/trailing-slash";
import { createDatabase } from "~/app/lib/database";
import { requestOrigin } from "~/app/lib/request-origin";
import { sessionCookie } from "~/app/lib/session-cookie";
import routes from "~/routes/management";

import { logger } from "./logger";

/**
 * Resolves a dashboard request's `__Host-session` cookie against the platform's own
 * identity tenant — the Durable Object addressed by the platform's own domain name,
 * the one hostname every deploy already names, so no separate provisioning step is
 * owed to reach it.
 */
async function resolveDashboardSubjectId(ctx: RequestContext): Promise<string | null> {
	let sessionToken = await sessionCookie.parse(ctx.request.headers.get("Cookie"));
	if (!sessionToken) return null;

	let stub = env.TENANT.getByName(env.PLATFORM_DOMAIN);
	let resolved = await stub.resolveSession({ token: sessionToken, ...requestOrigin(ctx.request) });

	return resolved.status === "active" ? resolved.subjectId : null;
}

/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`. */
let globalMiddleware: Middleware[] = [
	trailingSlash,
	log(logger) as Middleware,
	asyncContext(),
	database(createDatabase),
	formData() as Middleware,
	apiVersioning(),
];

/**
 * The management API's router, configured with the global middleware chain and a
 * `404` default handler — this pass answers `404` for everything but the token
 * endpoint until later passes populate it.
 *
 * @example
 * return await managementRouter.fetch(request);
 */
export const managementRouter = createRouter({
	middleware: globalMiddleware,
	defaultHandler: notFound,
});

managementRouter.map(routes.token, token);

export { resolveDashboardSubjectId };

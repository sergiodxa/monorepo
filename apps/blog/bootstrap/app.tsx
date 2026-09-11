/**
 * Assembles the blog HTTP application. Wires global middleware, maps public,
 * RSS, auth, admin-guarded CMS, and MCP routes onto the fetch router, and provides
 * the streaming HTML renderer and SSR frame resolver used by controllers.
 *
 * Every route is mapped through `lazy()`, so the URL surface is complete at startup
 * while each controller is imported by the first request that reaches it. A cold
 * isolate evaluates what it serves instead of the whole route table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";
import type { ResolveFrameContext } from "remix/ui/server";

import { headRequests } from "@sdxc/http/middleware/head-requests";
import { redirect } from "@sdxc/http/response";
import { lazy } from "@sdxc/lazy-route";
import { log } from "@sdxc/logger/middleware";
import workersCache from "@sdxc/workers-cache/middleware";
import { cache as platformCache } from "cloudflare:workers";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import type { AppContext, BlogRenderer, RenderOptions } from "~/app/http/context";

import auth from "~/app/http/middleware/auth";
import { isAuthenticated } from "~/app/http/middleware/auth";
import database from "~/app/http/middleware/database";
import createEnvMiddleware from "~/app/http/middleware/env";
import createNoTrailingSlashMiddleware from "~/app/http/middleware/no-trailing-slash";
import createNoWWWMiddleware from "~/app/http/middleware/no-www";
import purgePostList from "~/app/http/middleware/purge-post-list";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import mcpRateLimit from "~/app/mcp/rate-limit";
import { createDatabase } from "~/app/services/database";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

import { logger } from "./logger";

/**
 * Paths where a non-`GET` request signals a machine caller, since a reader's browser sends
 * only `GET` here. Matched exactly against the route table, so a path *beneath* one of
 * these still falls through to the full chain and the normal 404 page.
 */
const MACHINE_PATHS = new Set<string>([routes.mcp.index.href()]);

/**
 * Whether a request is the machine half of a machine path. Method-aware because `/mcp`
 * answers both: a `POST` is an agent speaking the protocol, while a `GET` is a person who
 * pasted the URL into a browser and needs the full reader page.
 */
function isMachineRequest(ctx: RequestContext): boolean {
	return ctx.method !== "GET" && MACHINE_PATHS.has(ctx.url.pathname);
}

/**
 * Scopes a middleware to the HTML surface. The session, redirect lookup and auth resolver
 * exist for a person's page view and would spend a KV read against a cookieless MCP
 * request; the renderer stays exempt, since a closure costs the same regardless.
 *
 * @param middleware Middleware that only applies to pages.
 * @returns Middleware that passes machine requests straight through.
 */
function htmlOnly(middleware: Middleware<any>): Middleware<any> {
	return (ctx, next) => {
		if (isMachineRequest(ctx)) return next();
		return middleware(ctx, next);
	};
}

/** Redirects anonymous CMS requests to login, preserving the request context typing. */
let requireCMSAuth: Middleware = (_ctx, next) => {
	if (isAuthenticated()) return next();
	return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
};

/**
 * The chain every CMS route runs behind. Declared here rather than inside each controller
 * so the group's guard is one decision: a new CMS route that forgets it is visible at the
 * map call, and it answers before the controller it protects is ever loaded.
 */
const CMS_GUARDS: Middleware[] = [requireCMSAuth, requireAdmin];

/** The same, for the routes that write, which invalidate the shared listing afterwards. */
const CMS_WRITE_GUARDS: Middleware[] = [...CMS_GUARDS, purgePostList];

/**
 * Builds the blog HTTP router with global middleware, route mappings, CMS auth
 * guards, and the HTML 404 fallback. `headRequests()` runs first so every later
 * middleware sees a plain `GET` and treats a `HEAD` probe as the page request;
 * `log(logger)` follows it and opens the request's wide event around everything else.
 * `workersCache` sits outside session and auth so its refusal check reads the finished
 * response, downgrading a public declaration once the visitor turns out to be identified.
 * `database(createDatabase)` is global, so `ctx.db` is there for a route the app maps and
 * for a handler behind a route-agnostic boundary alike.
 * @param env Worker environment bindings injected into request context.
 * @returns Configured router instance for the worker fetch entrypoint.
 */
export default function createApplication(env: App.Env) {
	let globalMiddleware: Array<Middleware<any>> = [
		headRequests(),
		log(logger),
		createEnvMiddleware(env),
		createNoWWWMiddleware(),
		createNoTrailingSlashMiddleware(),
		asyncContext(),
		database(createDatabase),
		workersCache({ cache: () => platformCache }),
		htmlOnly(session),
		formData(),
		methodOverride(),
		htmlOnly(redirects),
		htmlOnly(auth),
		renderWith(createHtmlRenderer),
	];
	let router = createRouter<AppContext>({
		middleware: globalMiddleware,

		async defaultHandler(ctx) {
			return ctx.render(
				NotFoundView,
				{
					title: "Page Not Found",
					description: "The page you are looking for does not exist.",
					emoji: "❓",
				},
				{ status: 404 },
			);
		},
	});

	router.map(
		routes.feed,
		lazy(() => import("~/app/http/controllers/feed")),
	);
	router.map(
		routes.colors,
		lazy(() => import("~/app/http/controllers/colors")),
	);
	router.map(
		routes.sponsor,
		lazy(() => import("~/app/http/controllers/sponsor")),
	);
	router.map(
		routes.sitemap,
		lazy(() => import("~/app/http/controllers/sitemap")),
	);
	router.map(
		routes.healthcheck,
		lazy(() => import("~/app/http/controllers/healthcheck")),
	);
	router.map(
		routes.articles,
		lazy(() => import("~/app/http/controllers/articles")),
	);
	router.map(
		routes.tutorials,
		lazy(() => import("~/app/http/controllers/tutorials")),
	);
	router.map(
		routes.bookmarks,
		lazy(() => import("~/app/http/controllers/bookmarks")),
	);
	router.map(
		routes.glossary,
		lazy(() => import("~/app/http/controllers/glossary")),
	);
	router.map(
		routes.post,
		lazy(() => import("~/app/http/controllers/post")),
	);
	router.map(
		routes.postRelated,
		lazy(() => import("~/app/http/controllers/post-related")),
	);

	/**
	 * The MCP endpoint sits outside every auth guard, keeping the blog freely readable by
	 * any agent, and reads `ctx.db` because an MCP tool's handler receives only a context
	 * to work with.
	 */
	router.map(
		routes.mcpMarkdown,
		lazy(() => import("~/app/http/controllers/mcp").then((it) => it.mcpMarkdownPage)),
	);
	router.map(routes.mcp, {
		actions: {
			index: lazy(() => import("~/app/http/controllers/mcp")),
			action: {
				middleware: [mcpRateLimit(env)],
				/**
				 * Imported here rather than through `lazy()`, because this action declares
				 * middleware that publishes context and so has to stay an action object,
				 * whose `handler` must be a function. The server is built at module scope,
				 * so deferring the import is what keeps it off a cold start.
				 */
				handler: async (ctx) => (await import("./mcp")).default.fetch(ctx),
			},
		},
	});

	router.map(
		routes.wellKnown,
		lazy(() => import("~/app/http/controllers/well-known")),
	);
	router.map(routes.rss, {
		actions: {
			feed: lazy(() => import("~/app/http/controllers/rss/feed")),
			articles: lazy(() => import("~/app/http/controllers/rss/articles")),
			tutorials: lazy(() => import("~/app/http/controllers/rss/tutorials")),
			bookmarks: lazy(() => import("~/app/http/controllers/rss/bookmarks")),
		},
	});
	router.map(
		routes.auth.login,
		lazy(() => import("~/app/http/controllers/auth").then((it) => it.loginController)),
	);
	router.map(
		routes.auth.logout,
		lazy(() => import("~/app/http/controllers/auth").then((it) => it.logoutController)),
	);
	router.map(
		routes.auth.callback,
		lazy(() => import("~/app/http/controllers/auth").then((it) => it.callbackAction)),
	);
	router.map(
		routes.cms.dashboard,
		lazy(() => import("~/app/http/controllers/cms/dashboard"), CMS_GUARDS),
	);
	router.map(
		routes.cms.purgeCache,
		lazy(() => import("~/app/http/controllers/cms/purge-cache"), CMS_GUARDS),
	);
	router.map(
		routes.cms.articles,
		lazy(() => import("~/app/http/controllers/cms/articles"), CMS_WRITE_GUARDS),
	);
	router.map(
		routes.cms.tutorials,
		lazy(() => import("~/app/http/controllers/cms/tutorials"), CMS_WRITE_GUARDS),
	);
	router.map(
		routes.cms.bookmarks,
		lazy(() => import("~/app/http/controllers/cms/bookmarks"), CMS_WRITE_GUARDS),
	);
	router.map(
		routes.cms.glossary,
		lazy(() => import("~/app/http/controllers/cms/glossary"), CMS_WRITE_GUARDS),
	);
	router.map(
		routes.cms.redirects,
		lazy(() => import("~/app/http/controllers/cms/redirects"), CMS_GUARDS),
	);

	return router;
}

/**
 * Creates the request-scoped renderer used by controllers via `ctx.render`,
 * exported so its guarantees can be asserted directly. `createHtmlResponse`
 * leads the stream with `<!DOCTYPE html>`, keeping every page in standards mode.
 */
export function createHtmlRenderer(ctx: RequestContext): BlogRenderer {
	return async function render(ViewComponent, viewModel, options?: RenderOptions) {
		let renderView = ViewComponent();
		let stream = renderToStream(renderView({ model: viewModel }), {
			frameSrc: ctx.request.url,
			resolveFrame(src, _target, context) {
				return resolveSsrFrame(ctx.request, src, context);
			},
		});
		let headers = new Headers(options?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return createHtmlResponse(stream, {
			status: options?.status ?? 200,
			headers,
		});
	};
}

async function resolveSsrFrame(request: Request, src: string, context?: ResolveFrameContext) {
	let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url);
	let headers = new Headers(request.headers);
	headers.set("accept", "text/html");

	let response = await fetch(frameUrl, { headers });
	if (response.ok) return response.body ?? (await response.text());
	return "";
}

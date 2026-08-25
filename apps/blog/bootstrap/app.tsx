/**
 * Assembles the blog HTTP application. Wires global middleware, maps public,
 * RSS, auth, admin-guarded CMS, and MCP routes onto the fetch router, and provides
 * the streaming HTML renderer and SSR frame resolver used by controllers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext } from "remix/router";
import type { ResolveFrameContext } from "remix/ui/server";

import { headRequests } from "@pkg/http/middleware/head-requests";
import { redirect } from "@pkg/http/response";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { methodOverride } from "remix/middleware/method-override";
import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import type { AppContext, BlogRenderer, RenderOptions } from "~/app/http/context";

import articles from "~/app/http/controllers/articles";
import { callbackAction, loginController, logoutController } from "~/app/http/controllers/auth";
import bookmarks from "~/app/http/controllers/bookmarks";
import articlesCMS from "~/app/http/controllers/cms/articles";
import bookmarksCMS from "~/app/http/controllers/cms/bookmarks";
import dashboardCMS from "~/app/http/controllers/cms/dashboard";
import glossaryCMS from "~/app/http/controllers/cms/glossary";
import redirectsCMS from "~/app/http/controllers/cms/redirects";
import tutorialsCMS from "~/app/http/controllers/cms/tutorials";
import colors from "~/app/http/controllers/colors";
import feed from "~/app/http/controllers/feed";
import glossary from "~/app/http/controllers/glossary";
import healthcheck from "~/app/http/controllers/healthcheck";
import post from "~/app/http/controllers/post";
import postRelated from "~/app/http/controllers/post-related";
import articlesRSS from "~/app/http/controllers/rss/articles";
import bookmarksRSS from "~/app/http/controllers/rss/bookmarks";
import feedRSS from "~/app/http/controllers/rss/feed";
import tutorialsRSS from "~/app/http/controllers/rss/tutorials";
import sitemap from "~/app/http/controllers/sitemap";
import sponsor from "~/app/http/controllers/sponsor";
import tutorials from "~/app/http/controllers/tutorials";
import wellKnown from "~/app/http/controllers/well-known";
import auth from "~/app/http/middleware/auth";
import { isAuthenticated } from "~/app/http/middleware/auth";
import database from "~/app/http/middleware/database";
import createEnvMiddleware from "~/app/http/middleware/env";
import createNoTrailingSlashMiddleware from "~/app/http/middleware/no-trailing-slash";
import createNoWWWMiddleware from "~/app/http/middleware/no-www";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import mcpRateLimit from "~/app/mcp/rate-limit";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

import mcp from "./mcp";

/**
 * Paths served to machines rather than to readers.
 *
 * Exact paths rather than a prefix, so an unmatched path *beneath* one of these still gets
 * the full chain and renders the normal 404 page. Taken from the route table so the two
 * cannot drift apart.
 */
const MACHINE_PATHS = new Set<string>([routes.mcp.href()]);

/**
 * Scopes a middleware to the HTML surface.
 *
 * The session, the redirect lookup and the auth resolver all exist for a person's page
 * view. An MCP request carries no cookie and follows no redirect, so for it each one is
 * either wasted work or a KV read spent on nothing.
 *
 * The renderer deliberately stays outside this: it only builds a closure, and leaving it in
 * place means anything that ever does render under a machine path still can.
 *
 * @param middleware Middleware that only applies to pages.
 * @returns Middleware that passes machine requests straight through.
 */
function htmlOnly(middleware: Middleware<any>): Middleware<any> {
	return (ctx, next) => {
		if (MACHINE_PATHS.has(ctx.url.pathname)) return next();
		return middleware(ctx, next);
	};
}

/** Redirects anonymous CMS requests to login, preserving the request context typing. */
let requireCMSAuth: Middleware = (_ctx, next) => {
	if (isAuthenticated()) return next();
	return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
};

/**
 * Builds the blog HTTP router with global middleware, route mappings, CMS auth
 * guards, and the HTML 404 fallback. `headRequests()` runs first so every later
 * middleware sees a plain `GET` and treats a `HEAD` probe as the page request.
 * @param env Worker environment bindings injected into request context.
 * @returns Configured router instance for the worker fetch entrypoint.
 */
export default function createApplication(env: App.Env) {
	let globalMiddleware: Array<Middleware<any>> = [
		headRequests(),
		createEnvMiddleware(env),
		createNoWWWMiddleware(),
		createNoTrailingSlashMiddleware(),
		asyncContext(),
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

	router.map(routes.feed, feed);
	router.map(routes.colors, colors);
	router.map(routes.sponsor, sponsor);
	router.map(routes.sitemap, sitemap);
	router.map(routes.healthcheck, healthcheck);
	router.map(routes.articles, articles);
	router.map(routes.tutorials, tutorials);
	router.map(routes.bookmarks, bookmarks);
	router.map(routes.glossary, glossary);
	router.map(routes.post, post);
	router.map(routes.postRelated, postRelated);

	// The MCP endpoint, outside every auth guard for the same reason the public pages are:
	// its whole point is that somebody's agent can read this blog without an account.
	//
	// `database()` rather than the container: an MCP tool receives only a context, so what it
	// needs has to be in that context, and scoping the middleware to this route leaves every
	// other handler resolving services the way it already did.
	router.map(routes.mcp, {
		middleware: [mcpRateLimit(env), database()],
		handler: (ctx) => mcp.fetch(ctx),
	});

	router.map(routes.wellKnown, wellKnown);
	router.map(routes.rss, {
		actions: {
			feed: feedRSS,
			articles: articlesRSS,
			tutorials: tutorialsRSS,
			bookmarks: bookmarksRSS,
		},
	});
	router.map(routes.auth.login, loginController);
	router.map(routes.auth.logout, logoutController);
	router.map(routes.auth.callback, callbackAction);
	router.map(routes.cms.dashboard, {
		middleware: [requireCMSAuth, requireAdmin],
		handler: dashboardCMS,
	});
	router.map(routes.cms.articles, {
		middleware: [requireCMSAuth, requireAdmin],
		actions: articlesCMS.actions,
	});
	router.map(routes.cms.tutorials, {
		middleware: [requireCMSAuth, requireAdmin],
		actions: tutorialsCMS.actions,
	});
	router.map(routes.cms.bookmarks, {
		middleware: [requireCMSAuth, requireAdmin],
		actions: bookmarksCMS.actions,
	});
	router.map(routes.cms.glossary, {
		middleware: [requireCMSAuth, requireAdmin],
		actions: glossaryCMS.actions,
	});
	router.map(routes.cms.redirects, {
		middleware: [requireCMSAuth, requireAdmin],
		actions: redirectsCMS.actions,
	});

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

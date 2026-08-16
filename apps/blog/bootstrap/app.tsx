/**
 * Assembles the blog HTTP application. Wires global middleware, maps public,
 * RSS, auth, and admin-guarded CMS routes onto the fetch router, and provides the
 * streaming HTML renderer and SSR frame resolver used by controllers.
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
import createEnvMiddleware from "~/app/http/middleware/env";
import createNoTrailingSlashMiddleware from "~/app/http/middleware/no-trailing-slash";
import createNoWWWMiddleware from "~/app/http/middleware/no-www";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

/** Redirects anonymous CMS requests to login without changing request context typing. */
let requireCMSAuth: Middleware = (_ctx, next) => {
	if (isAuthenticated()) return next();
	return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
};

/**
 * Builds the blog HTTP router with global middleware, route mappings,
 * CMS auth guards, and the HTML 404 fallback handler.
 * @param env Worker environment bindings injected into request context.
 * @returns Configured router instance for the worker fetch entrypoint.
 */
export default function createApplication(env: App.Env) {
	let globalMiddleware: Array<Middleware<any>> = [
		// First, so every middleware after it — the canonical-host redirects, the auth
		// guard, cross-origin protection — sees a plain `GET` and treats a `HEAD` probe
		// exactly as it would the page request behind it.
		headRequests(),
		createEnvMiddleware(env),
		createNoWWWMiddleware(),
		createNoTrailingSlashMiddleware(),
		asyncContext(),
		session,
		formData(),
		methodOverride(),
		redirects,
		auth,
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
 * Creates the request-scoped renderer used by controllers via `ctx.render`.
 *
 * Exported so the doctype and content type it guarantees can be asserted without
 * standing up the whole router.
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

		// `createHtmlResponse` rather than `new Response`, because it prepends
		// `<!DOCTYPE html>` to the stream's first chunk — the only place the doctype
		// can go, since JSX escapes text and the renderer exposes no option for it.
		// Without it every page parses in quirks mode. Fragment responses get one
		// too, which is harmless: `remix/ui` strips any doctype out of frame content
		// before inserting it, on the server and in the browser alike.
		return createHtmlResponse(stream, {
			status: options?.status ?? 200,
			headers,
		});
	};
}

/** Resolves SSR frames using the current request URL and forwarded headers. */
async function resolveSsrFrame(request: Request, src: string, context?: ResolveFrameContext) {
	let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url);
	let headers = new Headers(request.headers);
	headers.set("accept", "text/html");

	let response = await fetch(frameUrl, { headers });
	if (response.ok) return response.body ?? (await response.text());
	return "";
}

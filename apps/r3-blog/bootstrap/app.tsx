import type { Database } from "remix/data-table";
import type { Middleware } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import type { DefaultContext } from "@pkg/remix-helpers/context";
import middleware from "@pkg/remix-helpers/middleware";
import { asyncContext } from "remix/async-context-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

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
import createDatabaseMiddleware from "~/app/http/middleware/db";
import createEnvMiddleware from "~/app/http/middleware/env";
import createNoTrailingSlashMiddleware from "~/app/http/middleware/no-trailing-slash";
import createNoWWWMiddleware from "~/app/http/middleware/no-www";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import { isAuthenticated } from "~/app/http/middleware/auth";
import { view } from "~/app/infrastructure/view";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

/** Redirects anonymous CMS requests to login without changing request context typing. */
let requireCMSAuth = middleware((_ctx, next) => {
	if (isAuthenticated()) return next();
	return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
});

/**
 * Builds the r3-blog HTTP router with global middleware, route mappings,
 * CMS auth guards, and the HTML 404 fallback handler.
 * @param database Database connection used by request handlers.
 * @param env Worker environment bindings injected into request context.
 * @returns Configured router instance for the worker fetch entrypoint.
 */
export default function createApplication(database: Database, env: App.Env) {
	let globalMiddleware: Array<Middleware> = [
		createEnvMiddleware(env),
		createNoWWWMiddleware(),
		createNoTrailingSlashMiddleware(),
		asyncContext(),
		session,
		formData(),
		methodOverride(),
		redirects,
		createDatabaseMiddleware(database),
		auth,
	];
	let router = createRouter<DefaultContext>({
		middleware: globalMiddleware,

		async defaultHandler() {
			return view(
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
		middleware: [
			requireCMSAuth,
			requireAdmin,
		],
		handler: dashboardCMS,
	});
	router.map(routes.cms.articles, {
		middleware: [
			requireCMSAuth,
			requireAdmin,
		],
		actions: articlesCMS.actions,
	});
	router.map(routes.cms.tutorials, {
		middleware: [
			requireCMSAuth,
			requireAdmin,
		],
		actions: tutorialsCMS.actions,
	});
	router.map(routes.cms.bookmarks, {
		middleware: [
			requireCMSAuth,
			requireAdmin,
		],
		actions: bookmarksCMS.actions,
	});
	router.map(routes.cms.glossary, {
		middleware: [
			requireCMSAuth,
			requireAdmin,
		],
		actions: glossaryCMS.actions,
	});
	router.map(routes.cms.redirects, {
		middleware: [
			requireCMSAuth,
			requireAdmin,
		],
		actions: redirectsCMS.actions,
	});

	return router;
}

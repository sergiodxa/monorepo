import type { Database } from "remix/data-table";

import { redirect } from "@pkg/http/response";
import { asyncContext } from "remix/async-context-middleware";
import { requireAuth } from "remix/auth-middleware";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import articles from "~/app/http/controllers/articles";
import authController from "~/app/http/controllers/auth";
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
import tutorials from "~/app/http/controllers/tutorials";
import auth from "~/app/http/middleware/auth";
import createDatabaseMiddleware from "~/app/http/middleware/db";
import createEnvMiddleware from "~/app/http/middleware/env";
import createNoTrailingSlashMiddleware from "~/app/http/middleware/no-trailing-slash";
import createNoWWWMiddleware from "~/app/http/middleware/no-www";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import { view } from "~/app/infrastructure/view";
import { NotFoundView } from "~/resources/views/not-found";
import routes from "~/routes/web";

/**
 * Builds the r3-blog HTTP router with global middleware, route mappings,
 * CMS auth guards, and the HTML 404 fallback handler.
 * @param database Database connection used by request handlers.
 * @param env Worker environment bindings injected into request context.
 * @returns Configured router instance for the worker fetch entrypoint.
 */
export default function createApplication(database: Database, env: App.Env) {
	let router = createRouter({
		middleware: [
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
		],

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

	router.map(routes, {
		middleware: [],
		actions: {
			feed,
			colors,

			sitemap,

			articles,
			tutorials,
			bookmarks,
			glossary,

			post,
			postRelated,

			rss: {
				actions: {
					feed: feedRSS,
					articles: articlesRSS,
					tutorials: tutorialsRSS,
					bookmarks: bookmarksRSS,
				},
			},

			auth: authController,

			cms: {
				middleware: [
					requireAuth({
						onFailure() {
							return redirect(routes.auth.login.index.href(), {
								status: redirect.Status.SeeOther,
							});
						},
					}),
					requireAdmin,
				],

				actions: {
					dashboard: dashboardCMS,
					articles: articlesCMS,
					tutorials: tutorialsCMS,
					bookmarks: bookmarksCMS,
					glossary: glossaryCMS,
					redirects: redirectsCMS,
				},
			},
		},
	});

	return router;
}

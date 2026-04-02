import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import {
	auth as authMiddleware,
	createSessionAuthScheme,
	requireAuth,
} from "remix/auth-middleware";
import { renderToString } from "remix/component/server";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import articles from "~/app/http/controllers/articles";
import auth from "~/app/http/controllers/auth";
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
import articlesRSS from "~/app/http/controllers/rss/articles";
import bookmarksRSS from "~/app/http/controllers/rss/bookmarks";
import feedRSS from "~/app/http/controllers/rss/feed";
import tutorialsRSS from "~/app/http/controllers/rss/tutorials";
import sitemap from "~/app/http/controllers/sitemap";
import tutorials from "~/app/http/controllers/tutorials";
import asyncContext from "~/app/http/middleware/async-context";
import authState, {
	AUTH_SESSION_ID_TOKEN_KEY,
	AUTH_SESSION_USER_ID_KEY,
} from "~/app/http/middleware/auth-state";
import db, { db as database } from "~/app/http/middleware/db";
import noTrailingSlash from "~/app/http/middleware/no-trailing-slash";
import noWWW from "~/app/http/middleware/no-www";
import redirects from "~/app/http/middleware/redirects";
import requireAdmin from "~/app/http/middleware/require-admin";
import session from "~/app/http/middleware/session";
import { User } from "~/app/repositories/user";
import { BlogLayout } from "~/components/layout/blog";
import routes from "~/routes";
import { NotFoundView } from "~/views/not-found";

export const router = createRouter({
	middleware: [
		noWWW,
		noTrailingSlash,
		asyncContext,
		session,
		formData(),
		methodOverride(),
		redirects,
		db(),
		authMiddleware({
			schemes: [
				createSessionAuthScheme({
					read(session) {
						let userId = session.get(AUTH_SESSION_USER_ID_KEY);
						return typeof userId === "string" ? userId : null;
					},
					verify(userId) {
						return User.findById(database(), userId);
					},
					invalidate(session) {
						session.unset(AUTH_SESSION_USER_ID_KEY);
						session.unset(AUTH_SESSION_ID_TOKEN_KEY);
					},
				}),
			],
		}),
		authState,
	],

	async defaultHandler() {
		let body = await renderToString(
			<BlogLayout title="Not Found" description="The requested page was not found.">
				<NotFoundView
					title="Page Not Found"
					description="The page you are looking for does not exist."
					emoji="❓"
				/>
			</BlogLayout>,
		);

		return notFound(body);
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

		rss: {
			actions: {
				feed: feedRSS,
				articles: articlesRSS,
				tutorials: tutorialsRSS,
				bookmarks: bookmarksRSS,
			},
		},

		auth,

		cms: {
			middleware: [
				requireAuth({
					onFailure() {
						return redirect(routes.auth.login.index.href(), { status: redirect.Status.SeeOther });
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

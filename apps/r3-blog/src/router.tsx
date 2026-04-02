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

import { BlogLayout } from "~/components/layout/blog";
import articles from "~/controllers/articles";
import auth from "~/controllers/auth";
import bookmarks from "~/controllers/bookmarks";
import articlesCMS from "~/controllers/cms/articles";
import bookmarksCMS from "~/controllers/cms/bookmarks";
import dashboardCMS from "~/controllers/cms/dashboard";
import glossaryCMS from "~/controllers/cms/glossary";
import redirectsCMS from "~/controllers/cms/redirects";
import tutorialsCMS from "~/controllers/cms/tutorials";
import colors from "~/controllers/colors";
import feed from "~/controllers/feed";
import glossary from "~/controllers/glossary";
import post from "~/controllers/post";
import articlesRSS from "~/controllers/rss/articles";
import bookmarksRSS from "~/controllers/rss/bookmarks";
import feedRSS from "~/controllers/rss/feed";
import tutorialsRSS from "~/controllers/rss/tutorials";
import sitemap from "~/controllers/sitemap";
import tutorials from "~/controllers/tutorials";
import asyncContext from "~/middleware/async-context";
import authState, {
	AUTH_SESSION_ID_TOKEN_KEY,
	AUTH_SESSION_USER_ID_KEY,
} from "~/middleware/auth-state";
import db, { db as database } from "~/middleware/db";
import noTrailingSlash from "~/middleware/no-trailing-slash";
import noWWW from "~/middleware/no-www";
import redirects from "~/middleware/redirects";
import requireAdmin from "~/middleware/require-admin";
import session from "~/middleware/session";
import { User } from "~/models/user";
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

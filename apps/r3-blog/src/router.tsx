import { notFound } from "@pkg/http/response/html";
import { renderToString } from "remix/component/server";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { methodOverride } from "remix/method-override-middleware";

import { BlogLayout } from "~/components/layout/blog";
import articles from "~/controllers/articles";
import callback from "~/controllers/auth/callback";
import login from "~/controllers/auth/login";
import logout from "~/controllers/auth/logout";
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
import auth from "~/middleware/auth";
import authState from "~/middleware/auth-state";
import db from "~/middleware/db";
import noTrailingSlash from "~/middleware/no-trailing-slash";
import noWWW from "~/middleware/no-www";
import redirects from "~/middleware/redirects";
import session from "~/middleware/session";
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

		auth: {
			actions: {
				login,
				callback,
				logout,
			},
		},

		cms: {
			middleware: [auth],

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

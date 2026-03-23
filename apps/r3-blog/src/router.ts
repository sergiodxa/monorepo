import { createRouter } from "remix/fetch-router";

import articles from "~/controller/articles";
import bookmarks from "~/controller/bookmarks";
import cmsArticles from "~/controller/cms/articles";
import cmsBookmarks from "~/controller/cms/bookmarks";
import cmsDashboard from "~/controller/cms/dashboard";
import cmsGlossary from "~/controller/cms/glossary";
import cmsRedirects from "~/controller/cms/redirects";
import cmsTutorials from "~/controller/cms/tutorials";
import feed from "~/controller/feed";
import glossary from "~/controller/glossary";
import post from "~/controller/post";
import tutorials from "~/controller/tutorials";
import routes from "~/routes";

import db from "./middleware/db";

export const router = createRouter({
	middleware: [db()],
});

router.map(routes, {
	middleware: [],
	actions: {
		feed,
		articles,
		tutorials,
		bookmarks,
		glossary,
		post,

		cms: {
			dashboard: cmsDashboard,
			articles: cmsArticles,
			tutorials: cmsTutorials,
			bookmarks: cmsBookmarks,
			glossary: cmsGlossary,
			redirects: cmsRedirects,
		},
	},
});

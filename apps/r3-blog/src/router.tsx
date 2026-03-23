import { notFound } from "@pkg/http/response/html";
import { renderToString } from "remix/component/server";
import { createRouter } from "remix/fetch-router";

import { BlogLayout } from "~/components/layout/blog";
import articles from "~/controller/articles";
import bookmarks from "~/controller/bookmarks";
import cmsArticles from "~/controller/cms/articles";
import cmsBookmarks from "~/controller/cms/bookmarks";
import cmsDashboard from "~/controller/cms/dashboard";
import cmsGlossary from "~/controller/cms/glossary";
import cmsRedirects from "~/controller/cms/redirects";
import cmsTutorials from "~/controller/cms/tutorials";
import colors from "~/controller/colors";
import feed from "~/controller/feed";
import glossary from "~/controller/glossary";
import post from "~/controller/post";
import tutorials from "~/controller/tutorials";
import db from "~/middleware/db";
import routes from "~/routes";
import { NotFoundView } from "~/views/not-found";

export const router = createRouter({
	middleware: [db()],
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

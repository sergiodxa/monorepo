/**
 * Loader route that generates the site's XML sitemap. It loads all articles,
 * tutorials, and bookmarks, appends the home and section index URLs with their most
 * recent update dates, then appends every individual post URL. Exists to help search
 * engines discover and re-crawl the blog's content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Sitemap } from "@pkg/sitemap";
import { href } from "react-router";
import { xml } from "remix-utils/responses";

import { getDB } from "~/middleware/drizzle";
import { Article } from "~/models/article.server";
import { Like } from "~/models/like.server";
import { Tutorial } from "~/models/tutorial.server";

import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);
	url.pathname = "";

	let db = getDB();
	let sitemap = new Sitemap();

	let [articles, tutorials, bookmarks] = await Promise.all([
		Article.list({ db }),
		Tutorial.list({ db }),
		Like.list({ db }),
	]);

	let lastArticleDate = articles.at(0)?.createdAt ?? new Date();
	let lastTutorialDate = tutorials.at(0)?.createdAt ?? new Date();
	let lastBookmarkDate = bookmarks.at(0)?.createdAt ?? new Date();

	let lastPostDate = new Date(
		Math.max(lastArticleDate.getTime(), lastTutorialDate.getTime(), lastBookmarkDate.getTime()),
	);

	sitemap.append(new URL(href("/"), url), { updatedAt: lastPostDate });
	sitemap.append(new URL(href("/articles"), url), { updatedAt: lastArticleDate });
	sitemap.append(new URL(href("/tutorials"), url), { updatedAt: lastTutorialDate });
	sitemap.append(new URL(href("/bookmarks"), url), { updatedAt: lastBookmarkDate });

	for (let article of articles) {
		sitemap.append(new URL(article.pathname, url), { updatedAt: article.createdAt });
	}

	for (let tutorial of tutorials) {
		sitemap.append(new URL(tutorial.pathname, url), { updatedAt: tutorial.createdAt });
	}

	return xml(sitemap.toString());
}

/**
 * Data-access helper for the articles index route that lists articles for the
 * current viewer. It hides unpublished articles from non-admins and maps each
 * Article model into a lightweight { path, title, isPublished } shape for the
 * route to render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getDB } from "~/middleware/drizzle";
import { getUser } from "~/middleware/session";
import { Article } from "~/models/article.server";

export async function queryArticles() {
	let db = getDB();
	let user = getUser();
	let isAdmin = user?.role === "admin";

	let articles = await Article.list({ db }, { onlyPublished: !isAdmin });
	return articles.map((article) => {
		return {
			path: article.pathname,
			title: article.title,
			isPublished: article.isPublished,
		};
	});
}

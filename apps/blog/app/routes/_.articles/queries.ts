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

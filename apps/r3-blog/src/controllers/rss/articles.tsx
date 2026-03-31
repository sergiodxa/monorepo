import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";

import type routes from "~/routes";

import { db } from "~/middleware/db";
import { Post } from "~/models/post";
import { ArticlePost } from "~/models/posts/article";

export default action<typeof routes.rss.articles>(async (ctx) => {
	let articles = await ArticlePost.findAll(db());

	let rss = new RSS({
		title: "Articles — Sergio Xalambrí",
		description: "Articles by Sergio Xalambrí.",
		link: new URL("/articles", ctx.url).toString(),
	});

	for (let article of articles) {
		if (!Post.isPublishedAt(article.post.published_at)) continue;
		let link = new URL(`/articles/${article.meta.slug}`, ctx.url).toString();
		rss.addItem({
			guid: article.post.id,
			title: article.meta.title,
			description: article.meta.excerpt ?? link,
			link,
			pubDate: new Date(article.post.published_at ?? article.post.created_at).toUTCString(),
		});
	}

	return xml(rss.toString());
});

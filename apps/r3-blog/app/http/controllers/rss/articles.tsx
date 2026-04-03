import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";

import { db } from "~/app/http/middleware/db";
import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import routes from "~/routes/web";

export default action<typeof routes.rss.articles>(async (ctx) => {
	let articles = await ArticlePost.findAll(db());

	let rss = new RSS({
		title: "Articles — Sergio Xalambrí",
		description: "Articles by Sergio Xalambrí.",
		link: new URL(routes.articles.href(), ctx.url).toString(),
	});

	for (let article of articles) {
		if (!Post.isPublishedAt(article.published_at)) continue;
		let link = new URL(
			routes.post.href({ postType: "articles", postSlug: article.meta.slug }),
			ctx.url,
		).toString();
		rss.addItem({
			guid: article.id,
			title: article.meta.title,
			description: article.meta.excerpt ?? link,
			link,
			pubDate: new Date(article.published_at ?? article.created_at).toUTCString(),
		});
	}

	return xml(rss.toString());
});

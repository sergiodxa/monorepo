import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { PostListPage } from "~/components/pages";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";

export default action<typeof routes.articles>(async (ctx) => {
	let articles = await ArticlePost.listItems(db(ctx));
	let now = Date.now();
	let items = articles.map((article) => {
		let slug = article.slug;
		let href = `/articles/${slug}`;
		let publishedAt = article.published_at;
		let isPublished = publishedAt === null || Date.parse(publishedAt) <= now;

		return {
			href,
			label: article.title,
			preview: !isPublished,
		};
	});

	let body = await renderToString(
		<PostListPage
			title="Articles"
			description="These are my articles."
			activePath="/articles"
			rssPath="/articles.rss"
			items={items}
			emptyLabel="No articles yet."
		/>,
	);

	return ok(body);
});

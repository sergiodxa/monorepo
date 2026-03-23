import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { ArticlePost } from "~/models/posts/article";
import { ArticlesView } from "~/views/articles";

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
		<BlogLayout title="Articles" description="These are my articles." activePath="/articles">
			<ArticlesView items={items} />
		</BlogLayout>,
	);

	return ok(body);
});

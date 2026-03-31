import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { Post } from "~/models/post";
import { ArticlePost } from "~/models/posts/article";
import { ArticlesView } from "~/views/articles";

export default action<typeof routes.articles>(async () => {
	let articles = await ArticlePost.listItems(db());
	let items = articles.map((article) => {
		let slug = article.slug;
		let href = `/articles/${slug}`;
		let isPublished = Post.isPublishedAt(article.published_at);

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

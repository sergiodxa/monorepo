import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { Sitemap } from "@pkg/sitemap";
import { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import routes from "~/routes/web";

export default action<typeof routes.sitemap>(async (ctx) => {
	let database = ctx.get(Database);

	let [articles, tutorials, likes] = await Promise.all([
		ArticlePost.findAll(database),
		TutorialPost.findAll(database),
		LikePost.findAll(database),
	]);

	let sitemap = new Sitemap();

	let lastArticleDate = articles.at(0)?.created_at;
	let lastTutorialDate = tutorials.at(0)?.created_at;
	let lastBookmarkDate = likes.at(0)?.created_at;

	let dates = [lastArticleDate, lastTutorialDate, lastBookmarkDate]
		.filter(Boolean)
		.map((d) => new Date(d).getTime());

	let lastPostDate = dates.length > 0 ? new Date(Math.max(...dates)) : undefined;

	sitemap.append(new URL(routes.feed.href(), ctx.url), { updatedAt: lastPostDate });

	sitemap.append(new URL(routes.articles.href(), ctx.url), {
		updatedAt: lastArticleDate ? new Date(lastArticleDate) : undefined,
	});

	sitemap.append(new URL(routes.tutorials.href(), ctx.url), {
		updatedAt: lastTutorialDate ? new Date(lastTutorialDate) : undefined,
	});

	sitemap.append(new URL(routes.bookmarks.href(), ctx.url), {
		updatedAt: lastBookmarkDate ? new Date(lastBookmarkDate) : undefined,
	});

	sitemap.append(new URL(routes.glossary.href(), ctx.url));

	for (let article of articles) {
		if (!Post.isPublishedAt(article.published_at)) continue;
		sitemap.append(
			new URL(routes.post.href({ postType: "articles", postSlug: article.meta.slug }), ctx.url),
			{
				updatedAt: new Date(article.created_at),
			},
		);
	}

	for (let tutorial of tutorials) {
		if (!Post.isPublishedAt(tutorial.published_at)) continue;
		sitemap.append(
			new URL(routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }), ctx.url),
			{
				updatedAt: new Date(tutorial.created_at),
			},
		);
	}

	return xml(sitemap.toString());
});

import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { Sitemap } from "@pkg/sitemap";

import type routes from "~/routes";

import { db } from "~/middleware/db";
import { Post } from "~/models/post";
import { ArticlePost } from "~/models/posts/article";
import { LikePost } from "~/models/posts/like";
import { TutorialPost } from "~/models/posts/tutorial";

export default action<typeof routes.sitemap>(async (ctx) => {
	let database = db();
	let url = new URL(ctx.request.url);

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

	sitemap.append(new URL("/", url), { updatedAt: lastPostDate });

	sitemap.append(new URL("/articles", url), {
		updatedAt: lastArticleDate ? new Date(lastArticleDate) : undefined,
	});

	sitemap.append(new URL("/tutorials", url), {
		updatedAt: lastTutorialDate ? new Date(lastTutorialDate) : undefined,
	});

	sitemap.append(new URL("/bookmarks", url), {
		updatedAt: lastBookmarkDate ? new Date(lastBookmarkDate) : undefined,
	});

	sitemap.append(new URL("/glossary", url));

	for (let article of articles) {
		if (!Post.isPublishedAt(article.published_at)) continue;
		sitemap.append(new URL(`/articles/${article.meta.slug}`, url), {
			updatedAt: new Date(article.created_at),
		});
	}

	for (let tutorial of tutorials) {
		if (!Post.isPublishedAt(tutorial.published_at)) continue;
		sitemap.append(new URL(`/tutorials/${tutorial.meta.slug}`, url), {
			updatedAt: new Date(tutorial.created_at),
		});
	}

	return xml(sitemap.toString());
});

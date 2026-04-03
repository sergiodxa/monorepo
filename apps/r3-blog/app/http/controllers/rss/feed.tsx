import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";
import { Database } from "remix/data-table";

import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { GlossaryPost } from "~/app/repositories/posts/glossary";
import { LikePost } from "~/app/repositories/posts/like";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import routes from "~/routes/web";

export default action<typeof routes.rss.feed>(async (ctx) => {
	let database = ctx.get(Database);

	let [articles, tutorials, likes, glossary] = await Promise.all([
		ArticlePost.findAll(database),
		TutorialPost.findAll(database),
		LikePost.findAll(database),
		GlossaryPost.findAll(database),
	]);

	let rss = new RSS({
		title: "Sergio Xalambrí",
		description: "Articles, tutorials, bookmarks, and glossary terms by Sergio Xalambrí.",
		link: ctx.url.origin,
	});

	let items: Array<RSS.Item> = [];

	for (let article of articles) {
		if (!Post.isPublishedAt(article.published_at)) continue;
		let link = new URL(
			routes.post.href({ postType: "articles", postSlug: article.meta.slug }),
			ctx.url,
		).toString();
		items.push({
			guid: article.id,
			title: article.meta.title,
			description: article.meta.excerpt ?? link,
			link,
			pubDate: new Date(article.published_at ?? article.created_at).toUTCString(),
		});
	}

	for (let tutorial of tutorials) {
		if (!Post.isPublishedAt(tutorial.published_at)) continue;
		let link = new URL(
			routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }),
			ctx.url,
		).toString();
		items.push({
			guid: tutorial.id,
			title: tutorial.meta.title,
			description: tutorial.meta.excerpt ?? link,
			link,
			pubDate: new Date(tutorial.published_at ?? tutorial.created_at).toUTCString(),
		});
	}

	for (let like of likes) {
		items.push({
			guid: like.id,
			title: like.meta.title,
			description: like.meta.url,
			link: like.meta.url,
			pubDate: new Date(like.created_at).toUTCString(),
		});
	}

	for (let term of glossary) {
		let link = new URL(`${routes.glossary.href()}#${term.meta.slug}`, ctx.url).toString();
		let title = term.meta.title ? `${term.meta.term} (aka ${term.meta.title})` : term.meta.term;
		items.push({
			guid: term.id,
			title,
			description: term.meta.definition,
			link,
			pubDate: new Date(term.created_at).toUTCString(),
		});
	}

	items.sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate));

	for (let item of items) rss.addItem(item);

	return xml(rss.toString());
});

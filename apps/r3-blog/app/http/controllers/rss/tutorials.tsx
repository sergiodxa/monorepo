import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";

import { db } from "~/app/http/middleware/db";
import { Post } from "~/app/repositories/post";
import { TutorialPost } from "~/app/repositories/posts/tutorial";
import routes from "~/routes/web";

export default action<typeof routes.rss.tutorials>(async (ctx) => {
	let database = db();

	let tutorials = await TutorialPost.findAll(database);

	let rss = new RSS({
		title: "Tutorials — Sergio Xalambrí",
		description: "Tutorials by Sergio Xalambrí.",
		link: new URL(routes.tutorials.href(), ctx.url).toString(),
	});

	for (let tutorial of tutorials) {
		if (!Post.isPublishedAt(tutorial.published_at)) continue;
		let link = new URL(
			routes.post.href({ postType: "tutorials", postSlug: tutorial.meta.slug }),
			ctx.url,
		).toString();
		rss.addItem({
			guid: tutorial.id,
			title: tutorial.meta.title,
			description: tutorial.meta.excerpt ?? link,
			link,
			pubDate: new Date(tutorial.published_at ?? tutorial.created_at).toUTCString(),
		});
	}

	return xml(rss.toString());
});

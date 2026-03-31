import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";

import type routes from "~/routes";

import { db } from "~/middleware/db";
import { Post } from "~/models/post";
import { TutorialPost } from "~/models/posts/tutorial";

export default action<typeof routes.rss.tutorials>(async (ctx) => {
	let database = db();
	let url = new URL(ctx.request.url);

	let tutorials = await TutorialPost.findAll(database);

	let rss = new RSS({
		title: "Tutorials — Sergio Xalambrí",
		description: "Tutorials by Sergio Xalambrí.",
		link: new URL("/tutorials", url).toString(),
	});

	for (let tutorial of tutorials) {
		if (!Post.isPublishedAt(tutorial.published_at)) continue;
		let link = new URL(`/tutorials/${tutorial.meta.slug}`, url).toString();
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

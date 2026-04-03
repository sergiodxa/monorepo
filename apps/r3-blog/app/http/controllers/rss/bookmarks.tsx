import { xml } from "@pkg/http/response";
import action from "@pkg/remix-helpers/action";
import { RSS } from "@pkg/rss";
import { getContext } from "remix/async-context-middleware";

import { db } from "~/app/http/middleware/db";
import { LikePost } from "~/app/repositories/posts/like";
import routes from "~/routes/web";

export default action<typeof routes.rss.bookmarks>(async () => {
	let ctx = getContext() as any;
	let database = db();

	let likes = await LikePost.findAll(database);

	let rss = new RSS({
		title: "Bookmarks — Sergio Xalambrí",
		description: "Bookmarks by Sergio Xalambrí.",
		link: new URL(routes.bookmarks.href(), ctx.url).toString(),
	});

	for (let like of likes) {
		rss.addItem({
			guid: like.id,
			title: like.meta.title,
			description: like.meta.url,
			link: like.meta.url,
			pubDate: new Date(like.created_at).toUTCString(),
		});
	}

	return xml(rss.toString());
});

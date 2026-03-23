import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { PostListPage } from "~/components/pages";
import { db } from "~/middleware/db";
import { TutorialPost } from "~/models/posts/tutorial";

export default action<typeof routes.tutorials>(async (ctx) => {
	let tutorials = await TutorialPost.listItems(db(ctx));
	let now = Date.now();
	let items = tutorials.map((tutorial) => {
		let slug = tutorial.slug;
		let href = `/tutorials/${slug}`;
		let publishedAt = tutorial.published_at;
		let isPublished = publishedAt === null || Date.parse(publishedAt) <= now;

		return {
			href,
			label: tutorial.title,
			preview: !isPublished,
		};
	});

	let body = await renderToString(
		<PostListPage
			title="Tutorials"
			description="Learn about Remix, React, and more."
			activePath="/tutorials"
			rssPath="/tutorials.rss"
			items={items}
			emptyLabel="No tutorials yet."
			actionHref="/cms/tutorials/new"
			actionLabel="Write"
		/>,
	);

	return ok(body);
});

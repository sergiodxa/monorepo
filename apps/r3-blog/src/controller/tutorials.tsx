import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { TutorialPost } from "~/models/posts/tutorial";
import { TutorialsView } from "~/views/tutorials";

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
		<BlogLayout
			title="Tutorials"
			description="Learn about Remix, React, and more."
			activePath="/tutorials"
		>
			<TutorialsView items={items} />
		</BlogLayout>,
	);

	return ok(body);
});

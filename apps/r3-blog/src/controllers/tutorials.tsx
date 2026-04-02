import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { Post } from "~/models/post";
import { TutorialPost } from "~/models/posts/tutorial";
import routes from "~/routes";
import { TutorialsView } from "~/views/tutorials";

export default action<typeof routes.tutorials>(async () => {
	let tutorials = await TutorialPost.listItems(db());
	let items = tutorials.map((tutorial) => {
		let slug = tutorial.slug;
		let href = routes.post.href({ postType: "tutorials", postSlug: slug });
		let isPublished = Post.isPublishedAt(tutorial.published_at);

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
			activePath={routes.tutorials.href()}
		>
			<TutorialsView items={items} />
		</BlogLayout>,
	);

	return ok(body);
});

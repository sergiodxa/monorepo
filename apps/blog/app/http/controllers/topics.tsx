/**
 * HTTP action for `/topics`, the index of every topic: each kind's and each author's, by
 * title, linking to its page, where its feeds are offered.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { TopicViewModel } from "~/app/http/view-models/topic";
import { PUBLIC_PAGE, TAGS } from "~/app/initializers/cache";
import { TopicsView } from "~/resources/views/topics";
import routes from "~/routes/web";

/**
 * Serves the topic index, cached under the post-list tag, which the CMS purges on every
 * topic write.
 */
export default createAction(routes.topics, async (ctx) => {
	let topics = await ctx.models.topics.findAll();
	ctx.cache(PUBLIC_PAGE, TAGS.postList());
	return ctx.render(TopicsView, { topics: TopicViewModel.index(topics) });
});

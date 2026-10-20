/**
 * HTTP handlers for topic pages: every kind's listing at the root (`/articles`) and every
 * author's topic at `/topics/:slug`, with the latter's feeds at `/topics/:slug.rss`, `.atom`
 * and `.json`. One page and one feed path serve them all, so a new kind's page is one route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/initializers/router";
import type { SelectTopic } from "~/database/schema";

import { atomResponse } from "~/app/http/controllers/feeds/atom";
import { jsonFeedResponse } from "~/app/http/controllers/feeds/json-feed";
import { rssResponse } from "~/app/http/controllers/feeds/rss";
import { TopicParamsSchema } from "~/app/http/validators/topic";
import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { TOPIC_NOT_FOUND, topicPath, TopicViewModel } from "~/app/http/view-models/topic";
import { PUBLIC_PAGE, TAGS } from "~/app/initializers/cache";
import { PostSearch } from "~/app/models/search";
import { isBuiltInTopic } from "~/app/models/topics";
import {
	alphabetical,
	findKindTopic,
	listsEveryEntry,
	topicFeedPosts,
	topicPosts,
	topicQuery,
} from "~/app/services/topics";
import { NotFoundView } from "~/resources/views/not-found";
import { TopicView } from "~/resources/views/topic";
import routes from "~/routes/web";

/** The 404 page a topic URL naming no topic answers with. */
function topicNotFound(ctx: AppContext): Promise<Response> {
	return ctx.render(NotFoundView, NotFoundViewModel.page(TOPIC_NOT_FOUND), { status: 404 });
}

/**
 * Renders a topic's page: every match of its query on one page, newest first unless it asks
 * for an `order:`, so an old `?page=` address shows the whole list.
 */
async function renderTopic(ctx: AppContext, topic: SelectTopic): Promise<Response> {
	let query = topicQuery(topic);
	let posts =
		query === null ? [] : await topicPosts(ctx.models, await PostSearch.all(ctx.db, query));
	if (listsEveryEntry(topic)) posts = alphabetical(posts);
	ctx.cache(PUBLIC_PAGE, TAGS.postList());
	return ctx.render(TopicView, TopicViewModel.page({ topic, posts }));
}

/**
 * The handler for a kind's topic page at the root, which renders the topic the registry
 * names by `slug`, and answers 404 while its row is missing.
 *
 * @param slug The kind's `topic` in the registry.
 * @returns A handler for the kind's fixed route.
 * @example router.map(routes.articles, lazy(() => import("./topic").then((it) => it.kindTopic("articles"))))
 */
export function kindTopic(slug: string) {
	/** Serves the kind's topic page. */
	return async (ctx: AppContext): Promise<Response> => {
		let topic = await findKindTopic(ctx.models, slug);
		if (topic === null) return topicNotFound(ctx);
		return renderTopic(ctx, topic);
	};
}

/**
 * Serves an author's topic at `/topics/:slug`, and its feeds by extension. A kind's topic
 * reached here redirects to its own address at the root, where its page and feeds live.
 */
export default createAction(routes.topic, async (ctx) => {
	let params = await validate({ slug: ctx.params.slug, ext: ctx.params.ext }, TopicParamsSchema);
	if (isFailure(params)) return topicNotFound(ctx);
	let { slug, ext } = params.data;

	let topic = await ctx.models.topics.findBy({ slug });
	if (topic === null) return topicNotFound(ctx);

	if (isBuiltInTopic(topic.slug)) {
		let target = ext === undefined ? topicPath(topic) : `${topicPath(topic)}.${ext}`;
		return redirect(target, { status: redirect.Status.Permanent });
	}

	if (ext === undefined) return renderTopic(ctx, topic);

	let self = new URL(routes.topic.href({ slug, ext }), ctx.url).toString();
	let feed = TopicViewModel.feed(topic, await topicFeedPosts(ctx, topic), ctx.url);
	if (ext === "rss") return rssResponse(self, feed.channel, feed.entries);
	if (ext === "atom") return atomResponse(self, feed.channel, feed.entries, ctx.url.origin);
	return jsonFeedResponse(self, feed.channel, feed.entries, ctx.url.origin);
});

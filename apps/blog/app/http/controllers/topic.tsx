/**
 * HTTP handlers for topic pages: every kind's listing at the root (`/articles`) and every
 * author's topic at `/topics/:slug`, with the latter's feeds at `/topics/:slug.rss`, `.atom`
 * and `.json`. One page and one feed path serve them all, so a new kind's page is one route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createPaging } from "@sdxc/pagination";
import { isFailure, succeeded } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";

import type { AppContext } from "~/app/http/context";
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

/** Twenty posts a page, up to fifty for a reader who asks with `?perPage=`. */
const PAGING = createPaging({ perPage: 20, maxPerPage: 50 });

/** The 404 page a topic URL naming no topic answers with. */
function topicNotFound(ctx: AppContext): Promise<Response> {
	return ctx.render(NotFoundView, NotFoundViewModel.page(TOPIC_NOT_FOUND), { status: 404 });
}

/**
 * Renders a topic's page: its query's matches newest first unless it asks for an `order:`,
 * paged like `/search`, with malformed paging redirected to the first page. A kind's topic
 * whose posts are entries of its page, such as the glossary, lists every entry by term on
 * one page, so each entry's anchor resolves. The page is cached under the post-list tag,
 * which every CMS write purges, previews never appearing in it.
 */
async function renderTopic(ctx: AppContext, topic: SelectTopic): Promise<Response> {
	let path = topicPath(topic);
	let query = topicQuery(topic);

	if (listsEveryEntry(topic)) {
		let hits = query === null ? [] : await PostSearch.all(ctx.db, query);
		let posts = alphabetical(await topicPosts(ctx.models, hits));
		ctx.cache(PUBLIC_PAGE, TAGS.postList());
		return ctx.render(
			TopicView,
			TopicViewModel.page({ topic, posts, pagination: null, url: ctx.url }),
		);
	}

	let params = PAGING.parse(ctx.url.searchParams);
	if (isFailure(params)) return redirect(path);

	if (query === null) {
		ctx.cache(PUBLIC_PAGE, TAGS.postList());
		return ctx.render(
			TopicView,
			TopicViewModel.page({ topic, posts: [], pagination: null, url: ctx.url }),
		);
	}

	let page = await PostSearch.page(ctx.db, {
		query,
		page: params.data.page,
		perPage: params.data.perPage,
	});
	succeeded(page, "Listing a topic failed");

	let posts = await topicPosts(ctx.models, page.data.items);
	let headers = PAGING.paginate(new Headers(), page.data, { url: ctx.url });
	ctx.cache(PUBLIC_PAGE, TAGS.postList());

	return ctx.render(
		TopicView,
		TopicViewModel.page({ topic, posts, pagination: page.data.pagination, url: ctx.url }),
		{ headers },
	);
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

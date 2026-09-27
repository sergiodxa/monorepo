/**
 * Pings the WebSub hub after a CMS write stored a change, naming the feeds that write can
 * change, so subscribers receive the new item as it is published instead of on their next
 * poll. Each CMS route lists its own feeds, so a glossary edit pings only the site feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { waitUntil } from "cloudflare:workers";

import { pingHub } from "~/app/services/websub";

import { isStoredWrite } from "./purge-post-list";

/** A feed route, anything whose `href()` names the feed's path. */
interface FeedRoute {
	href(): string;
}

/**
 * Creates the middleware for a CMS route whose writes change the given feeds. The ping
 * runs after the response through `waitUntil`, since the hub fetches the feeds the moment
 * it is pinged; the feeds carry no edge cache, so that fetch reads the stored change.
 *
 * @param feeds The feed routes a stored write on this route changes.
 * @returns Middleware that pings the hub once per stored write.
 * @example lazy(() => import("./cms/articles"), [...CMS_WRITE_GUARDS, pingHubFor(routes.rss.feed, routes.rss.articles)])
 */
export default function pingHubFor(...feeds: FeedRoute[]): Middleware {
	return async (ctx, next) => {
		let response = await next();
		if (!isStoredWrite(ctx.method, response)) return response;

		let topics = feeds.map((feed) => new URL(feed.href(), ctx.url).toString());
		waitUntil(pingHub(topics, currentLog()));
		return response;
	};
}

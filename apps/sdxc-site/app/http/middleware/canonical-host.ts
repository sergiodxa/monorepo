/**
 * Sends a reader on a former address of the site to the same page on its current one, so
 * links, bookmarks and search results pointing at the old host keep landing on the right
 * page while every crawler converges on one origin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { FORMER_HOSTS, SITE_URL } from "~/config/site";

/**
 * Answers a `GET` or `HEAD` on a former host with a permanent redirect to the same path and
 * query on {@link SITE_URL}. Every other method reaches its handler on whichever host it
 * arrived, so a webhook or an MCP client still configured with the old address keeps working.
 */
export default function canonicalHost(): Middleware {
	return (context, next) => {
		let { method } = context.request;
		if (method !== "GET" && method !== "HEAD") return next();
		if (!FORMER_HOSTS.includes(context.url.hostname)) return next();

		let target = new URL(context.url.pathname + context.url.search, SITE_URL);
		return Response.redirect(target.href, 301);
	};
}

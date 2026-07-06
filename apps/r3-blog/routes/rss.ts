/**
 * Route definitions for the r3-blog RSS feeds. Declares the combined site feed
 * endpoint alongside dedicated article, tutorial, and bookmark feed URLs so
 * subscribers can follow either everything or a single content stream.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/fetch-router/routes";

/**
 * Exposes RSS endpoints for the site feed plus article, tutorial, and bookmark feeds.
 */
export default route({
	feed: get("/rss"),
	articles: get("/articles.rss"),
	tutorials: get("/tutorials.rss"),
	bookmarks: get("/bookmarks.rss"),
});

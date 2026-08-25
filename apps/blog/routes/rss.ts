/**
 * Route definitions for the blog RSS feeds: the combined site feed plus the
 * per-type article, tutorial, and bookmark feeds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/**
 * Typed feed URL helpers so subscribers can follow everything or a single
 * content stream.
 */
export default route({
	feed: get("/rss"),
	articles: get("/articles.rss"),
	tutorials: get("/tutorials.rss"),
	bookmarks: get("/bookmarks.rss"),
});

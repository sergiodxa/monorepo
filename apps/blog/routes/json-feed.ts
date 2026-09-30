/**
 * Route definitions for the blog JSON Feeds: the combined site feed plus the
 * per-type article, tutorial, and bookmark feeds, one per RSS feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, route } from "remix/routes";

/**
 * Typed JSON Feed URL helpers, keyed by the same stream names as the RSS routes.
 */
export default route({
	feed: get("/feed.json"),
	articles: get("/articles.json"),
	tutorials: get("/tutorials.json"),
	bookmarks: get("/bookmarks.json"),
});

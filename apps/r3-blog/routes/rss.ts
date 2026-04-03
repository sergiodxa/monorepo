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

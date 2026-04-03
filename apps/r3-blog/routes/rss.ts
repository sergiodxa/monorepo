import { get, route } from "remix/fetch-router/routes";

export default route({
	feed: get("/rss"),
	articles: get("/articles.rss"),
	tutorials: get("/tutorials.rss"),
	bookmarks: get("/bookmarks.rss"),
});

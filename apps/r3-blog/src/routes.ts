import { route, get, resources } from "remix/fetch-router/routes";

export default route({
	feed: get("/"),

	articles: get("/articles"),
	tutorials: get("/tutorials"),
	bookmarks: get("/bookmarks"),
	glossary: get("/glossary"),

	post: get("/:postType/:postSlug(.:ext)"),

	cms: route("/cms", {
		dashboard: get("/"),

		articles: resources("/articles"),
		tutorials: resources("/tutorials"),
		bookmarks: resources("/bookmarks"),
		glossary: resources("/glossary"),
		redirects: resources("/redirects"),
	}),
});

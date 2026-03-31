import { route, get, resources, form } from "remix/fetch-router/routes";

export default route({
	feed: get("/"),
	colors: get("/colors"),

	rss: {
		feed: get("/rss"),
		articles: get("/articles.rss"),
		tutorials: get("/tutorials.rss"),
		bookmarks: get("/bookmarks.rss"),
	},

	sitemap: get("/sitemap.xml"),

	articles: get("/articles"),
	tutorials: get("/tutorials"),
	bookmarks: get("/bookmarks"),
	glossary: get("/glossary"),

	post: get("/:postType/:postSlug(.:ext)"),

	auth: {
		login: form("/login"),
		logout: form("/logout"),
		callback: get("/auth/callback"),
	},

	cms: route("/cms", {
		dashboard: get("/"),
		articles: resources("/articles", { exclude: ["show"] }),
		tutorials: resources("/tutorials", { exclude: ["show"] }),
		bookmarks: resources("/bookmarks", { exclude: ["show"] }),
		glossary: resources("/glossary", { exclude: ["show"] }),
		redirects: resources("/redirects", { only: ["index", "new", "create", "destroy"] }),
	}),
});

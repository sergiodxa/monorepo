import { get, route } from "remix/fetch-router/routes";

import auth from "~/routes/auth";
import cms from "~/routes/cms";
import rss from "~/routes/rss";

export default route({
	feed: get("/"),
	colors: get("/colors"),

	sitemap: get("/sitemap.xml"),

	articles: get("/articles"),
	tutorials: get("/tutorials"),
	bookmarks: get("/bookmarks"),
	glossary: get("/glossary"),

	post: get("/:postType/:postSlug(.:ext)"),
	postRelated: get("/frames/posts/:postType/:postSlug/related"),

	auth,

	rss,

	cms: route("/cms", cms),
});

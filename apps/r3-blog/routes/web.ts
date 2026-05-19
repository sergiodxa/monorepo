import { get, route } from "remix/fetch-router/routes";

import auth from "~/routes/auth";
import cms from "~/routes/cms";
import rss from "~/routes/rss";

/**
 * Registers the public site routes and mounts auth, RSS, and CMS sub-routers.
 */
export default route({
	feed: get("/"),
	colors: get("/colors"),
	sponsor: get("/sponsor"),

	wellKnown: route({
		webFinger: get("/.well-known/webfinger"),
		avatar: get("/.well-known/avatar"),
	}),

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

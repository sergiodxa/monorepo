/**
 * Central route table for the whole engine, shared by the router (`engine.ts`) and
 * every controller so paths and `href()` builders stay in one place. Fixed routes
 * are declared before the dynamic `:typePath` public routes so they win.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { form, get, resources, route } from "remix/routes";

/**
 * The engine's route map. Fixed routes are declared before the dynamic
 * `:typePath` public routes so they win; the router maps each group separately.
 */
export const routes = route({
	feed: get("/"),

	sitemap: get("/sitemap.xml"),
	robots: get("/robots.txt"),
	rss: get("/rss.xml"),
	typeRss: get("/:typePath.rss"),

	assets: get("/assets/:file"),

	auth: route({
		login: form("/auth/login"),
		logout: form("/auth/logout"),
		callback: get("/auth/callback"),
	}),

	cms: route("/cms", {
		dashboard: get("/"),
		posts: resources("/types/:typeName/posts", { exclude: ["show"] }),
		postTypes: resources("/post-types", { exclude: ["show"] }),
		users: resources("/users", { only: ["index", "edit", "update", "destroy"] }),
		roles: resources("/roles", { exclude: ["show"] }),
		settings: form("/settings"),
		appearance: form("/appearance"),
	}),

	typeIndex: get("/:typePath"),
	post: get("/:typePath/:slug"),
});

export default routes;

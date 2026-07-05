import { form, get, post, resources, route } from "remix/fetch-router/routes";

/**
 * The platform dashboard + marketing route map (mapped in `bootstrap/app.ts`).
 *
 * The per-blog `domain`/`usage`/`restore` routes are siblings of the `blogs`
 * resources map (not nested inside it): the router maps one route group per
 * `map()` call and a nested route-map key throws at runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export default route({
	index: get("/"),
	health: get("/health"),

	auth: route({
		login: form("/auth/login"),
		callback: get("/auth/callback"),
		logout: form("/auth/logout"),
	}),

	api: route({
		webhooks: route({ polar: post("/api/webhooks/polar") }),
	}),

	dashboard: route({
		index: get("/dashboard"),
		billing: form("/dashboard/billing"),
		blogs: resources("/dashboard/blogs", {
			only: ["new", "create", "show", "edit", "update", "destroy"],
		}),
		blogDomain: form("/dashboard/blogs/:blogId/domain"),
		blogUsage: get("/dashboard/blogs/:blogId/usage"),
		blogRestore: post("/dashboard/blogs/:blogId/restore"),
	}),
});

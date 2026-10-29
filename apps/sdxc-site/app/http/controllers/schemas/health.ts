/**
 * `GET /schemas/health.json` — the JSON Schema of the `application/health+json` report, at
 * the URL its `$id` names, so an editor, a CI step or a monitor outside JavaScript can
 * reference it. The document is the one `@sdxc/health` ships, imported at build time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import HEALTH_SCHEMA from "@sdxc/health/schema.json" with { type: "json" };
import { policy } from "@sdxc/http/cache";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/**
 * The schema changes only with a deploy that upgrades `@sdxc/health`, so every cache may keep
 * it for a day and serve it for a week more while refreshing. Any origin may read it, since
 * schema tools in a browser fetch it cross-origin.
 */
export default createAction(routes.schemas.health, () => {
	let cacheControl = policy({
		visibility: "public",
		maxAge: "1 day",
		staleWhileRevalidate: "7 days",
	});

	return new Response(JSON.stringify(HEALTH_SCHEMA), {
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": cacheControl.toString(),
			"Content-Type": "application/schema+json",
		},
	});
});

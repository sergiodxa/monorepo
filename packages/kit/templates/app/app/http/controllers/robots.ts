/**
 * `/robots.txt`: every crawler may read every page, and the sitemap lists them. Add a rule here
 * before a path should stay out of search results.
 */

import { text } from "@sdxc/http/response";
import { stringify } from "@sdxc/robots";
import { createAction } from "remix/router";

import { seo } from "~/app/initializers/seo";
import routes from "~/routes/web";

export default createAction(routes.robots, {
	/** GET /robots.txt, cached for a day since it changes only with a deploy. */
	handler: () =>
		text(
			stringify({
				groups: [{ userAgents: ["*"], rules: [{ allow: true, pattern: "/" }] }],
				sitemaps: [seo.absolute(routes.sitemap.href())],
				records: [],
			}),
			{ headers: { "Cache-Control": "public, max-age=86400" } },
		),
});

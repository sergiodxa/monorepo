/**
 * `/sitemap.xml`: every public page, at its canonical URL, for search engines to find. Every
 * GET route in `routes/web.ts` needs a decision here, so a new route fails to typecheck until
 * it is listed or excluded.
 */

import { xml } from "@sdxc/http/response";
import { fromRoutes } from "@sdxc/sitemap/remix";
import { createAction } from "remix/router";

import { seo } from "~/app/initializers/seo";
import routes from "~/routes/web";

export default createAction(routes.sitemap, {
	/** GET /sitemap.xml, cached for an hour, with URLs on `SITE_URL` whichever host served it. */
	handler: () => {
		let sitemap = fromRoutes(routes, seo.baseUrl, {
			home: { priority: 1 },
			robots: false,
			sitemap: false,
			notFound: false,
		});
		return xml(sitemap.toString(), { headers: { "Cache-Control": "public, max-age=3600" } });
	},
});

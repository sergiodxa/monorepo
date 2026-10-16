/**
 * `/sitemap.xml`: every public page, at its canonical URL, for search engines to find. List a
 * new page here when it should be indexed.
 */

import { xml } from "@sdxc/http/response";
import { Sitemap } from "@sdxc/sitemap";
import { createAction } from "remix/router";

import { seo } from "~/app/initializers/seo";
import routes from "~/routes/web";

export default createAction(routes.sitemap, {
	/** GET /sitemap.xml, cached for an hour. */
	handler: () => {
		let sitemap = new Sitemap();
		sitemap.append(new URL(seo.absolute(routes.home.href())), { priority: 1 });
		return xml(sitemap.toString(), { headers: { "Cache-Control": "public, max-age=3600" } });
	},
});

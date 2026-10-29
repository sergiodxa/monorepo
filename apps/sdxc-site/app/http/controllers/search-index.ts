/**
 * `GET /search.json` — every page and every heading a reader can jump to, as one
 * document, for anything that wants to search this site with its own ranking rather than
 * scraping the pages. The site's own search ranks the same index on the server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { buildSearchIndex } from "~/app/services/search";
import routes from "~/routes/web";

export default createAction(routes.searchIndex, async (ctx) => {
	let documents = await buildSearchIndex();
	return await withBundleCache(ctx.request, json({ documents }));
});

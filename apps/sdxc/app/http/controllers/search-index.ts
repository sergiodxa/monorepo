/**
 * `GET /search.json` — every page and every heading a reader can jump to, as one
 * document. The palette fetches it once and filters in the browser, which is what keeps
 * a keystroke off the network, and anything else that wants to search this site reads the
 * same file rather than scraping the pages.
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

/**
 * `GET /llms.txt` — the site as a markdown map for a model orienting itself, built from
 * the same guides and manifests the sidebar reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { withBundleCache } from "~/app/http/caching";
import { buildLlmsTxt } from "~/app/services/llms";
import routes from "~/routes/web";

export default createAction(routes.llms, async (ctx) => {
	return await withBundleCache(ctx.request, text(await buildLlmsTxt()));
});

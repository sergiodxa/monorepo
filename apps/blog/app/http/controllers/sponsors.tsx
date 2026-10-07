/**
 * HTTP action for the public `/sponsors` page. It reads the sponsor roster the scheduled
 * refresh stored in `CACHE` and renders the pitch around it, so the page never waits on
 * GitHub and still makes its case while the roster is unknown.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { createAction } from "remix/router";

import { getEnv } from "~/app/http/middleware/env";
import { readStoredSponsors } from "~/app/services/sponsors";
import { SponsorsView } from "~/resources/views/sponsors";
import routes from "~/routes/web";

/**
 * Serves the sponsors page with the stored roster.
 * @returns HTML response for the sponsors route.
 */
export default createAction(routes.sponsors, async (ctx) => {
	let cache = new WorkerKVCache(getEnv("CACHE"), { waitUntil: getEnv("waitUntil") });
	let roster = await readStoredSponsors(cache);

	return ctx.render(SponsorsView, roster);
});

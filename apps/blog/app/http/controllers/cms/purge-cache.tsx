/**
 * HTTP action that empties the edge cache. It is the operator's escape hatch:
 * a cached page is served without this Worker running, so shipping a fix cannot
 * evict a bad entry and only a purge can. It clears everything rather than a tag
 * because the situation it answers is not knowing which entries are wrong.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import { purge } from "@sdxc/workers-cache";
import { cache as platformCache } from "cloudflare:workers";

import routes from "~/routes/web";

/** Recorded when the operator's purge did not reach the platform. */
const PURGE_FAILED_EVENT = "cache.purge_all_failed";

/**
 * Empties the edge cache and reports the outcome on the dashboard.
 *
 * The result travels in the redirect rather than a flash, so the operator sees
 * whether the cache actually cleared without this route inventing session state.
 *
 * @returns See Other back to the dashboard, carrying the outcome.
 */
export default async function purgeCache(): Promise<Response> {
	let result = await purge(platformCache, { everything: true });

	if (isFailure(result)) {
		currentLog()?.warn(PURGE_FAILED_EVENT, { error: result.error.message });
	}

	return redirect(`${routes.cms.dashboard.href()}?purge=${isFailure(result) ? "failed" : "ok"}`, {
		status: redirect.Status.SeeOther,
	});
}

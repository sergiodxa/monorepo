/**
 * Refreshes the sponsor roster `/sponsors` renders from GitHub, on a schedule, so a page
 * never waits on GitHub and the roster survives an outage there. A run that cannot reach
 * GitHub, or a worker without `GITHUB_TOKEN`, leaves the stored roster in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { refreshSponsors } from "~/app/services/sponsors";

/**
 * Records the skip or the counts it stored; a failed read is logged and the run ends
 * there, since the next scheduled run retries it.
 */
export default createJobHandler(jobs.sponsors.refresh, async (ctx) => {
	let token = env.GITHUB_TOKEN;
	if (!token) return void ctx.log.set({ sponsors: { skipped: "missing_token" } });

	let roster = await refreshSponsors(new WorkerKVCache(env.CACHE), token);
	if (isFailure(roster)) return void ctx.log.fail(roster.error);

	ctx.log.set({ sponsors: { current: roster.data.current.length, past: roster.data.past.length } });
});

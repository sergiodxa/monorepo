/**
 * Cloudflare Worker entry point. Its `fetch` handler builds the application router and
 * forwards the request, and its `scheduled` handler refreshes the one piece of content
 * that lives outside the bundle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { siteCache } from "~/app/initializers/cache";
import { logger } from "~/app/initializers/logger";
import { createWebRouter } from "~/app/initializers/router";
import { refreshSponsors } from "~/app/services/sponsors";

export default {
	/** Handles an incoming request by building the web router and forwarding it. */
	async fetch(request: Request) {
		let router = createWebRouter();
		return await router.fetch(request);
	},

	/**
	 * Reads the sponsors from GitHub into the cache the pages render from, so a page
	 * never waits on GitHub and the list survives an outage there.
	 */
	async scheduled(_event: ScheduledController, env: Cloudflare.Env) {
		let log = logger.open("cron", { trigger: "sponsors.refresh" });
		let token = env.GITHUB_TOKEN;

		await log
			.run(async () => {
				if (!token) return void log.set({ skipped: "missing_token" });
				let roster = await refreshSponsors(siteCache(), token);
				log.set({ current: roster.current.length, past: roster.past.length });
			})
			.catch(() => undefined);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

/**
 * Cloudflare Worker entry point. Its `fetch` handler builds the application router and
 * forwards the request, and its `scheduled` handler refreshes the one piece of content
 * that lives outside the bundle. It is the only module that touches
 * Cloudflare-specific APIs, so everything below it runs without a worker runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { siteCache } from "~/app/services/cache";
import { refreshSponsors } from "~/app/services/sponsors";

import application from "./app";
import { logger } from "./logger";

export default {
	/** Handles an incoming request by building the app router and forwarding it. */
	async fetch(request: Request) {
		let app = application();
		return await app.fetch(request);
	},

	/**
	 * Reads the sponsors from GitHub into the cache the footer renders from, so a page
	 * never waits on GitHub and the list survives an outage there. A run that cannot
	 * reach GitHub leaves the stored list in place, which is the whole point of doing
	 * this here rather than in a request. GitHub's sponsor query needs a token, so a
	 * worker without `GITHUB_TOKEN` records the skip and keeps the stored list.
	 */
	async scheduled(_event: ScheduledController, env: Cloudflare.Env) {
		let log = logger.open("cron", { trigger: "sponsors.refresh" });
		let token = env.GITHUB_TOKEN;

		await log
			.run(async () => {
				if (!token) return void log.set({ skipped: "missing_token" });
				let sponsors = await refreshSponsors(siteCache(), token);
				log.set({ count: sponsors.length });
			})
			.catch(() => undefined);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

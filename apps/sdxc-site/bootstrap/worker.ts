/**
 * Cloudflare Worker entry point. Its `fetch` handler builds the application router and
 * forwards the request, and its `scheduled` handler refreshes what the site reads from
 * outside the bundle: the sponsors weekly, and daily npm's download history, deps.dev's
 * dependents and the repository's GitHub stats.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { siteCache } from "~/app/initializers/cache";
import { logger } from "~/app/initializers/logger";
import { createWebRouter } from "~/app/initializers/router";
import { refreshAdoption } from "~/app/services/adoption";
import { refreshGitHubStats } from "~/app/services/github-stats";
import { refreshNpmStats } from "~/app/services/npm-stats";
import { refreshSponsors } from "~/app/services/sponsors";

/**
 * The trigger in `cloudflare.config.ts` that reads npm, deps.dev and GitHub's repository
 * stats; every other one refreshes the sponsors.
 */
const NPM_STATS_SCHEDULE = "0 4 * * *";

/** How long the daily run keeps reading npm, well inside a scheduled invocation's limit. */
const NPM_STATS_BUDGET = 10 * 60 * 1000;

/**
 * Refreshes the quick daily reads ahead of npm's long one, each under its own log, so one
 * source failing leaves the others' snapshots refreshed.
 *
 * @param token The GitHub credential, absent where the worker has none.
 */
async function refreshDaily(token: string | undefined) {
	let cache = siteCache();
	let reads = [
		["adoption.refresh", () => refreshAdoption(cache, token)],
		["github-stats.refresh", () => refreshGitHubStats(cache, token)],
	] as const;

	for (let [trigger, read] of reads) {
		let log = logger.open("cron", { trigger });
		await log
			.run(async () => {
				let snapshot = await read();
				log.set({ stored: snapshot !== null });
			})
			.catch(() => undefined);
	}
}

export default {
	/** Handles an incoming request by building the web router and forwarding it. */
	async fetch(request: Request) {
		let router = createWebRouter();
		return await router.fetch(request);
	},

	/**
	 * Reads the sponsors from GitHub, or npm's download history, into the cache the pages
	 * render from, so a page never waits on either and survives an outage there.
	 */
	async scheduled(event: ScheduledController, env: Cloudflare.Env) {
		if (event.cron === NPM_STATS_SCHEDULE) {
			await refreshDaily(env.GITHUB_TOKEN);
			let log = logger.open("cron", { trigger: "npm-stats.refresh" });
			await log
				.run(async () => {
					let outcome = await refreshNpmStats(siteCache(), { budget: NPM_STATS_BUDGET });
					let { failed, rateLimited, read, remaining } = outcome;
					log.set({ read, failed, remaining, rateLimited });
				})
				.catch(() => undefined);
			return;
		}

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

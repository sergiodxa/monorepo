/**
 * The Worker's entry point. `fetch` builds the router and forwards the request to it, and
 * `queue` hands each delivered batch to the job dispatcher, so every request and every job
 * reaches the app through the initializers that configure it.
 */

import * as cloudflare from "sdxc/jobs/cloudflare";

import { dispatcher } from "~/app/initializers/dispatcher";
import { createWebRouter } from "~/app/initializers/router";

/** The dispatcher's queue and cron handlers, bound once per isolate. */
const JOBS = cloudflare.worker(dispatcher);

export default {
	/** Answers a request through the web router. */
	async fetch(request) {
		let router = createWebRouter();
		return await router.fetch(request);
	},

	/** Runs every job a cron trigger is the schedule for. */
	async scheduled(controller) {
		await JOBS.scheduled(controller);
	},

	/** Runs the job each queued message names, settling once every one of them has. */
	async queue(batch) {
		await JOBS.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

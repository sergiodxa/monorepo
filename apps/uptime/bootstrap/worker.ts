/**
 * Cloudflare Worker entry point for the uptime app. Its `fetch` handler resolves the
 * session cookie secret, builds the application router, and forwards the request to it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

import { dispatcher } from "~/app/initializers/dispatcher";
import { createWebRouter } from "~/app/initializers/router";
import { CostLedger, countedKv, trackCost } from "~/app/services/cost";

/**
 * Both job handlers, bound to the dispatcher they delegate to. This worker consumes its own
 * dead-letter queue too, so those batches are recorded and acked rather than
 * dispatched; a body matching no job or failing its schema is written there directly, instead
 */
const handlers = cloudflare.worker(dispatcher, {
	deadLetterQueue: "ping-dlq",
	deadLetter: () => env.DLQ,
});

export { GeoFetchDO } from "~/app/services/geo-fetch";

/** Whether the request arrived on a non-production host (local dev or workers.dev). */
function isSecureHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}

export default {
	/** Handles incoming Worker requests by forwarding them to the app router. */
	async fetch(request: Request) {
		let router = createWebRouter({
			kv: countedKv(env.KV),
			cookieSecret: env.COOKIE_SESSION_SECRET,
			secure: isSecureHost(request),
		});
		/**
		 * Which team a request is for is settled downstream — `requireTeam` for the app,
		 * the status-page controller for a public one — so the ledger opens unattributed and
		 * is told once resolved. One that never resolves (a marketing page, a 404) is platform cost.
		 */
		return await trackCost(new CostLedger({ handler: "fetch" }), () => router.fetch(request));
	},

	/**
	 * Enqueues every job the delivered trigger is the schedule for. One ledger for the whole
	 * delivery: a cron trigger attributes to no team, so its invocation and its single queue
	 * write are recorded as platform cost, which is what they are.
	 */
	async scheduled(controller) {
		await trackCost(new CostLedger({ handler: "scheduled" }), () => handlers.scheduled(controller));
	},

	/**
	 * Runs the matching job for each queued message, for both of the queues this worker
	 * consumes: `ping` and its dead-letter queue.
	 */
	async queue(batch) {
		await handlers.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

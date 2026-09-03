/**
 * Cloudflare Worker entry point for the uptime app. Its `fetch` handler resolves
 * the session cookie secret, opens a service-container scope, builds the application
 * router, and forwards the request to it. Its `scheduled` and `queue` handlers hand the
 * trigger and the batch to the job dispatcher, which owns routing, validation and the
 * lifecycle for both the work queue and its dead-letter queue. Re-exports the `GeoFetchDO`
 * Durable Object class its binding needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { GeoFetchDO } from "~/app/do/geo-fetch";
import { dispatcher } from "~/app/jobs/dispatcher";
import { container } from "~/app/lib/container";
import { CostLedger, countedKv, trackCost } from "~/app/services/cost";

import application from "./app";

export { GeoFetchDO };

/** Whether the request arrived on a non-production host (local dev or workers.dev). */
function isSecureHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}

export default {
	/**
	 * Handles incoming Worker requests by opening a container scope and forwarding the
	 * request to the app router.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let app = application({
				kv: countedKv(env.KV),
				cookieSecret: env.COOKIE_SESSION_SECRET,
				secure: isSecureHost(request),
			});
			/**
			 * Which team a request is for is settled downstream — `requireTeam` for the app,
			 * the status-page controller for a public one — so the ledger opens unattributed and
			 * is told once resolved. One that never resolves (a marketing page, a 404) is platform cost.
			 */
			return await trackCost(new CostLedger({ handler: "fetch" }), () => app.fetch(request));
		});
	},

	/**
	 * Enqueues every job the delivered trigger is the schedule for. One ledger for the whole
	 * delivery: a cron trigger attributes to no team, so its invocation and its single queue
	 * write are recorded as platform cost, which is what they are.
	 */
	async scheduled(controller) {
		await trackCost(new CostLedger({ handler: "scheduled" }), () =>
			dispatcher.scheduled(controller),
		);
	},

	/**
	 * Runs the matching job for each queued message, for both of the queues this worker
	 * consumes: `ping` and its dead-letter queue.
	 */
	async queue(batch) {
		await container.scope(() => dispatcher.queue(batch));
	},
} satisfies ExportedHandler<Cloudflare.Env>;

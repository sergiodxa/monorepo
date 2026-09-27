/**
 * Cloudflare Worker entrypoint for blog. A request gets its secrets and bindings (with
 * `waitUntil`, so a deferred cache write outlives the response) and goes to the app
 * router; queue deliveries and cron triggers go to the job dispatcher.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as cloudflare from "@sdxc/jobs/cloudflare";

import { dispatcher } from "~/app/jobs/dispatcher";

import createApplication from "./app";

/** The queue and cron entrypoints, bound to the dispatcher every job runs through. */
const handlers = cloudflare.worker(dispatcher);

export default {
	async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
		let IS_PROD = resolveIsProd(request);

		let [CLIENT_ID, CLIENT_SECRET, COOKIE_SESSION_SECRET] = await Promise.all([
			env.CLIENT_ID.get(),
			env.CLIENT_SECRET.get(),
			env.COOKIE_SESSION_SECRET.get(),
		]);

		let router = createApplication({
			IS_PROD,
			CLIENT_ID,
			CLIENT_SECRET,
			COOKIE_SESSION_SECRET,
			AUTH: env.AUTH,
			REDIRECTS: env.REDIRECTS,
			CACHE: env.CACHE,
			MCP_RATE_LIMITER: env.MCP_RATE_LIMITER,
			WEBMENTION_RATE_LIMITER: env.WEBMENTION_RATE_LIMITER,
			waitUntil: (promise) => ctx.waitUntil(promise),
		});

		return await router.fetch(request);
	},

	/**
	 * Cron entrypoint. Enqueues every job declaring the schedule that fired and returns;
	 * the work happens on the queue delivery.
	 *
	 * @param controller The scheduled controller carrying the triggering `cron`.
	 */
	async scheduled(controller: ScheduledController) {
		await handlers.scheduled(controller);
	},

	/**
	 * Queue entrypoint. Runs each delivered message as the job it names, inside the
	 * dispatcher's middleware chain.
	 *
	 * @param batch The delivered messages.
	 */
	async queue(batch: MessageBatch) {
		await handlers.queue(batch);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

function resolveIsProd(request: Request) {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}

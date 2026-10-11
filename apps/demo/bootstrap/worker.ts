/**
 * Cloudflare Worker entry point. Its `fetch` handler builds the router and forwards the
 * request; its `scheduled` handler enqueues the jobs the delivered trigger is the schedule
 * for and runs them, which is the whole of the board's nightly work.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as cloudflare from "@sdxc/jobs/cloudflare";

import { openDatabase } from "~/app/initializers/database";
import { createDispatcher, drain } from "~/app/initializers/dispatcher";
import application from "~/app/initializers/router";

export default {
	/** Handles an incoming request by building the app router and forwarding it. */
	async fetch(request: Request) {
		let app = application();
		return await app.fetch(request);
	},

	/**
	 * Enqueues every job this trigger is the schedule for, then runs them. The queue holds
	 * its messages in memory, so the trigger that enqueued them is what settles them too.
	 */
	async scheduled(controller: ScheduledController) {
		let runtime = createDispatcher(openDatabase);
		await cloudflare.worker(runtime.dispatcher).scheduled(controller);
		await drain(runtime);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

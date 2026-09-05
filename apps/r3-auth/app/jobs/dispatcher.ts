/**
 * Where every job's handler comes from, and the chain each one runs inside. Both worker
 * handlers delegate here: a cron delivery enqueues through it and a queue delivery is
 * dispatched by it, so the two share one path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobDispatcherContext } from "@sdxc/jobs";

import { createJobDispatcher } from "@sdxc/jobs";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { database, scope } from "~/app/jobs/middleware/database";
import { logger } from "~/bootstrap/logger";

/**
 * The registry `bootstrap/worker.ts` hands its batches and triggers to. Both the queue
 * write and the ping token are read per call, so nothing reaches a binding until a
 * message is enqueued or a run completes.
 */
export const dispatcher = createJobDispatcher({
	logger,
	middleware: [scope(), database()],
	send: async (bodies) => {
		await env.QUEUE.sendBatch(bodies.map((body) => ({ body, contentType: "json" })));
	},
	uptime: () => env.UPTIME_CRON_API_KEY,
});

/**
 * A loader rather than the handler itself, so a request that only enqueues never parses
 * the sweep's module.
 */
dispatcher.map(jobs.cleanExpiredSessions, () => import("~/app/jobs/clean-expired-sessions"));

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

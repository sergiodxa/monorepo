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
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { createUptimeReporter } from "@sdxc/jobs/uptime";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { database, scope } from "~/app/jobs/middleware/database";
import { logger } from "~/bootstrap/logger";

/** Reports a completed run to the monitor watching it. The token resolves per call. */
const uptime = createUptimeReporter({ token: () => env.UPTIME_CRON_API_KEY });

/**
 * The registry `bootstrap/worker.ts` hands its batches and triggers to. Both the queue
 * write and the ping token are read per call, so nothing reaches a binding until a
 * message is enqueued or a run completes.
 */
export const dispatcher = createJobDispatcher({
	logger,
	middleware: [scope(), database()],
	queue: cloudflare.queue(() => env.QUEUE),

	/**
	 * Reports the sweep once it completes. Awaited rather than handed to `waitUntil`, so a
	 * ping the service refuses reaches this run's own record.
	 */
	async onEnd(ctx, status) {
		if (status.type !== "done") return;

		let sweep = ctx.of(jobs.cleanExpiredSessions);
		if (sweep === null) return;

		await uptime(sweep.meta.monitorId);
	},
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

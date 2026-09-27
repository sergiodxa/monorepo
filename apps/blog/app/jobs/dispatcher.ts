/**
 * The job dispatcher: the queue every job is enqueued on, the middleware each runs
 * inside, and the handler each job's name loads. The worker's `queue` and `scheduled`
 * entrypoints both delegate here, so a cron trigger and a delivery share one path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobDispatcherContext } from "@sdxc/jobs";

import { createJobDispatcher } from "@sdxc/jobs";
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { logger } from "~/bootstrap/logger";

import { database } from "./middleware/database";

/**
 * The registry both worker entrypoints run through. The timeout sits under the
 * consumer's wall-clock budget, leaving a handler room to settle once the signal aborts;
 * every outbound fetch a job makes is bounded well inside it.
 */
export const dispatcher = createJobDispatcher({
	logger,
	middleware: [database()],
	timeout: "2 minutes",

	/** Resolved per call, so importing this module touches no binding. */
	queue: cloudflare.queue(() => env.QUEUE),
});

dispatcher.map(jobs.webmentions.verify, () => import("~/app/jobs/webmentions/verify"));

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

/**
 * The job dispatcher: the queue every job is enqueued on and the handler each job's name
 * loads. The worker's `queue` entrypoint delegates here, and a feed's object enqueues
 * through it, loading no handler until a message for it arrives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobDispatcherContext } from "@sdxc/jobs";

import { createJobDispatcher } from "@sdxc/jobs";

import { logger } from "~/app/initializers/logger";
import { jobQueue } from "~/app/initializers/queue";
import jobs from "~/app/jobs";

/**
 * The registry the queue entrypoint runs through. The timeout sits under the consumer's
 * wall-clock budget; a history walk bounds each fetch well inside it.
 */
export const dispatcher = createJobDispatcher({
	logger,
	middleware: [],
	timeout: "2 minutes",
	queue: jobQueue,
});

dispatcher.map(jobs.feeds.backfill, () => import("~/app/jobs/feeds/backfill"));

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

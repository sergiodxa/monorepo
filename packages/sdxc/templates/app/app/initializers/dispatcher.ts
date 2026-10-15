/**
 * The job dispatcher: every background job is enqueued through it and runs inside it, over
 * the Cloudflare queue the Worker consumes. `sdxc make job` maps each new handler here, as a
 * loader, so a module is imported only once a message for its job arrives.
 */

import { env } from "cloudflare:workers";
import { createJobDispatcher } from "sdxc/jobs";
import * as cloudflare from "sdxc/jobs/cloudflare";

import { logger } from "~/app/initializers/logger";

/** The dispatcher `bootstrap/worker.ts` hands queue batches and cron triggers to. */
export const dispatcher = createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	timeout: "5 minutes",
});

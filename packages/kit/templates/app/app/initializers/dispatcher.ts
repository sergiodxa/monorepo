/**
 * The job dispatcher: every background job is enqueued through it and runs inside it, over
 * the Cloudflare queue the Worker consumes. `sdxc make job` maps each new handler here, as a
 * loader, so a module is imported only once a message for its job arrives.
 */

import type { JobDispatcherContext } from "@sdxc/jobs";

import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { env } from "cloudflare:workers";

import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";

/** The dispatcher `bootstrap/worker.ts` hands queue batches and cron triggers to. */
export const dispatcher = createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	middleware: [database(openDatabase)] as const,
	timeout: "5 minutes",
});

declare module "@sdxc/jobs" {
	/** Types every job handler's `ctx` with what the dispatcher's middleware publishes, `ctx.db` included. */
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

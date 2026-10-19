/**
 * The job dispatcher: every background job is enqueued through it and runs inside it, over
 * the Cloudflare queue the Worker consumes. `sdxc make job` maps each new handler here, as a
 * loader, so a module is imported only once a message for its job arrives.
 */

import type { JobDispatcherContext } from "@sdxc/jobs";

import { models } from "@sdxc/data-model/jobs";
import { Database } from "@sdxc/database-middleware";
import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";
import * as cloudflare from "@sdxc/jobs/cloudflare";
import mailer from "@sdxc/mail/middleware/jobs";
import { env } from "cloudflare:workers";

import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { queue, transport } from "~/app/initializers/mail-transport";
import jobs from "~/app/jobs";
import registry from "~/app/models";
import { MAIL_FROM } from "~/config/constants";

/** The dispatcher `bootstrap/worker.ts` hands queue batches and cron triggers to. */
export const dispatcher = createJobDispatcher({
	logger,
	queue: cloudflare.queue(() => env.QUEUE),
	middleware: [
		database(openDatabase),
		models(registry, (ctx) => ({ db: ctx.require(Database) })),
		mailer({ transport, from: MAIL_FROM, mail, queue }),
	] as const,
	timeout: "5 minutes",
});

dispatcher.map(jobs.email, () => import("~/app/jobs/email"));

declare module "@sdxc/jobs" {
	/** Types every job handler's `ctx` with what the dispatcher's middleware publishes: `ctx.db`, `ctx.models` and `ctx.email`. */
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

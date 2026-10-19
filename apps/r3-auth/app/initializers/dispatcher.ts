/**
 * Where every job's handler comes from, and the chain each one runs inside. Both worker
 * handlers delegate here: a cron delivery enqueues through it and a queue delivery is
 * dispatched by it, so the two share one path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobDispatcherContext } from "@sdxc/jobs";

import { models } from "@sdxc/data-model/jobs";
import { Database } from "@sdxc/database-middleware";
import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";
import * as cloudflare from "@sdxc/jobs/cloudflare";
import { createUptimeReporter } from "@sdxc/jobs/uptime";
import mailer from "@sdxc/mail/middleware/jobs";
import { env } from "cloudflare:workers";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { openDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { queueEmail, transport } from "~/app/initializers/mail-transport";
import jobs from "~/app/jobs";
import registry from "~/app/models";

/** Reports a completed run to the monitor watching it. The token resolves per call. */
const uptime = createUptimeReporter({ token: () => env.UPTIME_CRON_API_KEY });

/**
 * The registry `bootstrap/worker.ts` hands its batches and triggers to. Both the queue
 * write and the ping token are read per call, so nothing reaches a binding until a
 * message is enqueued or a run completes.
 */
export const dispatcher = createJobDispatcher({
	logger,
	middleware: [
		database(openDatabase),
		models(registry, (ctx) => ({ db: ctx.require(Database) })),
		mailer({
			transport,
			from: MAIL_FROM,
			replyTo: MAIL_REPLY_TO,
			mail,
			queue: queueEmail,
		}),
	] as const,
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

/** Delivers what `ctx.email.queue()` enqueued, loaded only once a delivery arrives. */
dispatcher.map(jobs.email, () => import("~/app/jobs/email"));

declare module "@sdxc/jobs" {
	/** Types every job handler's `ctx` with what the dispatcher's middleware publishes: `ctx.db`, `ctx.models` and `ctx.email`. */
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

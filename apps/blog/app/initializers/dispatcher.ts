/**
 * The job dispatcher: the queue every job is enqueued on, the middleware each runs
 * inside, and the handler each job's name loads. The worker's `queue` and `scheduled`
 * entrypoints both delegate here, so a cron trigger and a delivery share one path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { JobDispatcherContext, JobEnqueuer } from "@sdxc/jobs";

import { models } from "@sdxc/data-model/jobs";
import { Database } from "@sdxc/database-middleware";
import { database } from "@sdxc/database-middleware/jobs";
import { createJobDispatcher } from "@sdxc/jobs";
import mailer from "@sdxc/mail/middleware/jobs";

import { createDatabase } from "~/app/initializers/database";
import { logger } from "~/app/initializers/logger";
import { mail } from "~/app/initializers/mail";
import { mailTransport } from "~/app/initializers/mail-transport";
import { jobQueue } from "~/app/initializers/queue";
import jobs from "~/app/jobs";
import { activityPub } from "~/app/jobs/middleware/activitypub";
import registry from "~/app/models";
import { MAIL_FROM } from "~/config/mail";

/**
 * The registry both worker entrypoints run through. The timeout sits under the
 * consumer's wall-clock budget, leaving a handler room to settle once the signal aborts;
 * every outbound fetch a job makes is bounded well inside it.
 */
export const dispatcher = createJobDispatcher({
	logger,
	middleware: [
		database(createDatabase),
		models(registry, (ctx) => ({ db: ctx.require(Database) })),
		mailer({ transport: mailTransport, from: MAIL_FROM, mail }),
		activityPub(enqueuer),
	],
	timeout: "2 minutes",
	queue: jobQueue,
});

/**
 * The dispatcher, for middleware it lists that enqueues through it once a job runs.
 */
function enqueuer(): JobEnqueuer {
	return dispatcher;
}

dispatcher.map(jobs.webmentions.verify, () => import("~/app/jobs/webmentions/verify"));
dispatcher.map(jobs.webmentions.send, () => import("~/app/jobs/webmentions/send"));
dispatcher.map(jobs.webmentions.deliver, () => import("~/app/jobs/webmentions/deliver"));
dispatcher.map(jobs.webmentions.scheduled, () => import("~/app/jobs/webmentions/scheduled"));
dispatcher.map(jobs.bookmarks.inspect, () => import("~/app/jobs/bookmarks/inspect"));
dispatcher.map(jobs.bookmarks.archive, () => import("~/app/jobs/bookmarks/archive"));
dispatcher.map(jobs.bookmarks.sweep, () => import("~/app/jobs/bookmarks/sweep"));
dispatcher.map(jobs.bookmarks.digest, () => import("~/app/jobs/bookmarks/digest"));
dispatcher.map(jobs.activityPub.process, () => import("~/app/jobs/activitypub/process"));
dispatcher.map(jobs.activityPub.publish, () => import("~/app/jobs/activitypub/publish"));
dispatcher.map(jobs.activityPub.scheduled, () => import("~/app/jobs/activitypub/scheduled"));
dispatcher.map(jobs.releases.weekly, () => import("~/app/jobs/releases/weekly"));
dispatcher.map(jobs.sponsors.refresh, () => import("~/app/jobs/sponsors/refresh"));

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

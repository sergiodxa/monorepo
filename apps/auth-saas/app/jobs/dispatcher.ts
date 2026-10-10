/**
 * The job dispatcher: the queue write every job reaches the platform queue through, the
 * middleware chain each one runs inside, and the handler each job's name loads. Both
 * worker handlers delegate here, so a cron trigger and a queue delivery share one path.
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
import { hostnames } from "./middleware/hostnames";
import { mail } from "./middleware/mail";
import { models } from "./middleware/models";
import { tenant } from "./middleware/tenant";

/**
 * The registry both worker handlers run through. Every job gets the control-plane
 * database and its models, the custom-hostname client, the tenant Durable Object namespace and a
 * mailer, since building each is a constructor call apiece and no job pays for I/O
 * it skips.
 */
export const dispatcher = createJobDispatcher({
	logger,
	middleware: [database(), models(), hostnames(), tenant(), mail()],
	timeout: "5 minutes",

	/**
	 * The platform queue this dispatcher writes through. The binding resolves per call
	 * rather than at module scope, so importing this module touches none.
	 */
	queue: cloudflare.queue(() => env.QUEUE),
});

dispatcher.map(jobs.refreshPendingDomains, () => import("~/app/jobs/refresh-pending-domains"));
dispatcher.map(
	jobs.sweepDueWebhookDeliveries,
	() => import("~/app/jobs/sweep-due-webhook-deliveries"),
);
dispatcher.map(jobs.deliverWebhook, () => import("~/app/jobs/deliver-webhook"));
dispatcher.map(
	jobs.checkAttackSignalBaseline,
	() => import("~/app/jobs/check-attack-signal-baseline"),
);
dispatcher.map(jobs.subjectsImport, () => import("~/app/jobs/subjects-import"));
dispatcher.map(jobs.subjectsExport, () => import("~/app/jobs/subjects-export"));

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

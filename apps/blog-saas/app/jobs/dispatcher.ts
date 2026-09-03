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
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";

import { database } from "./middleware/database";
import { hostnames } from "./middleware/hostnames";
import { provisioner } from "./middleware/provisioner";

/**
 * The registry both worker handlers run through. Every job gets the control-plane
 * database, the custom-hostname client, and the provisioner, since building them is a
 * constructor call apiece and no job pays for I/O it skips. The
 * timeout is under the consumer's own wall-clock budget, leaving each handler room to
 * settle its delivery once the signal aborts.
 */
export const dispatcher = createJobDispatcher({
	middleware: [database(), hostnames(), provisioner()],
	timeout: "10 minutes",

	/**
	 * Writes the dispatcher's messages to the platform queue. The binding is read here
	 * rather than at module scope, so importing this module touches no binding.
	 *
	 * @param bodies One body per message, each already carrying its job's `type`.
	 */
	async send(bodies) {
		await env.QUEUE.sendBatch(bodies.map((body) => ({ body, contentType: "json" })));
	},
});

dispatcher.map(jobs.reportUsage, () => import("~/app/jobs/report-usage"));
dispatcher.map(jobs.purgeDeletedBlogs, () => import("~/app/jobs/purge-deleted-blogs"));
dispatcher.map(jobs.pollHostnames, () => import("~/app/jobs/poll-hostnames"));

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<typeof dispatcher>;
	}
}

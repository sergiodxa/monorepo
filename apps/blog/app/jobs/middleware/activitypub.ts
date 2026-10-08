/**
 * Publishes the blog's ActivityPub federation to every job, under the same context key
 * HTTP handlers read, so a federation job takes `ctx.activityPub` and a test hands it one
 * with generated keys and an in-memory queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Federation } from "@sdxc/activitypub";
import type { JobMiddleware } from "@sdxc/jobs";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { env } from "cloudflare:workers";

import { ActivityPub } from "~/app/http/middleware/activitypub";
import { Database } from "~/app/http/middleware/database";
import jobs from "~/app/jobs";
import { createFederation } from "~/app/services/activitypub";
import { BLOG_KEYS } from "~/app/services/activitypub-keys";

/**
 * The federation's queue in a job, written through the dispatcher. The dispatcher is
 * imported when a message is written, because it lists this middleware itself.
 */
const DISPATCHER_QUEUE: Federation.Queue = {
	async enqueue(message) {
		let { dispatcher } = await import("~/app/jobs/dispatcher");
		await dispatcher.enqueue(jobs.activityPub.process, message);
	},
	async enqueueMany(messages) {
		let { dispatcher } = await import("~/app/jobs/dispatcher");
		await dispatcher.enqueueMany(jobs.activityPub.process, messages);
	},
};

/**
 * Publishes the federation for the job about to run, over the database `database()`
 * published before it.
 *
 * @returns The middleware installing it as `ctx.activityPub`.
 * @example createJobDispatcher({ middleware: [database(), activityPub()] });
 */
export function activityPub(): JobMiddleware<{
	key: typeof ActivityPub;
	value: Federation;
	property: "activityPub";
}> {
	return async (ctx, next) => {
		let federation = createFederation({
			db: ctx.require(Database),
			cache: new WorkerKVCache(env.CACHE),
			keys: BLOG_KEYS,
			queue: DISPATCHER_QUEUE,
		});
		ctx.set(ActivityPub, federation, { property: "activityPub" });
		await next();
	};
}

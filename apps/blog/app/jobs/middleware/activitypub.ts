/**
 * Publishes the blog's ActivityPub federation to every job, under the same context key
 * HTTP handlers read, so a federation job takes `ctx.activityPub` and a test hands it one
 * with generated keys and an in-memory queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Federation } from "@sdxc/activitypub";
import type { JobEnqueuer, JobMiddleware } from "@sdxc/jobs";

import { WorkerKVCache } from "@sdxc/cache/worker-kv";
import { Models } from "@sdxc/data-model";
import { env } from "cloudflare:workers";

import type { BlogModels } from "~/app/models";

import { ActivityPub } from "~/app/http/middleware/activitypub";
import { Database } from "~/app/http/middleware/database";
import { createFederation, federationQueue } from "~/app/services/activitypub";
import { BLOG_KEYS } from "~/app/services/activitypub-keys";

/**
 * Publishes the federation for the job about to run, over the database `database()`
 * published before it. The enqueuer is read when a job runs, so the dispatcher listing
 * this middleware can hand over itself.
 *
 * @param enqueuer Returns what the federation's queue writes through.
 * @returns The middleware installing it as `ctx.activityPub`.
 * @example createJobDispatcher({ middleware: [database(), activityPub(() => dispatcher)] });
 */
export function activityPub(enqueuer: () => JobEnqueuer): JobMiddleware<{
	key: typeof ActivityPub;
	value: Federation;
	property: "activityPub";
}> {
	return async (ctx, next) => {
		let federation = createFederation({
			db: ctx.require(Database),
			models: ctx.require(Models) as BlogModels,
			cache: new WorkerKVCache(env.CACHE),
			keys: BLOG_KEYS,
			queue: federationQueue(enqueuer()),
		});
		ctx.set(ActivityPub, federation, { property: "activityPub" });
		await next();
	};
}

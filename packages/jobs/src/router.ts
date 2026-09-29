/**
 * The middleware a `remix/router` fetch router installs to publish `ctx.jobs`, so a route
 * handler enqueues a job from the map straight through the queue. Only the queue enters the
 * request path's module graph: the dispatcher, its middleware and every handler stay out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { unwrap } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { JobEnqueuer } from "./enqueue.js";
import type { JobQueue } from "./queue.js";

import { createJobEnqueuer } from "./enqueue.js";

export type { JobEnqueuer } from "./enqueue.js";

/**
 * Declared in an imported module rather than an ambient declaration, so a project types
 * `ctx.jobs` by importing this middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Enqueues jobs from the app's map, published by the `jobEnqueuer()` middleware. */
		jobs: JobEnqueuer;
	}
}

/**
 * The enqueuer the current request writes through, for code that reads it by key rather
 * than through the installed `jobs` property. The type is written out because an exported
 * key needs a nameable type to reach a published declaration file.
 */
export const Jobs: { defaultValue?: JobEnqueuer } = createContextKey<JobEnqueuer>();

const JOBS_PROPERTY = { property: "jobs" } as const;

/**
 * Publishes `ctx.jobs`, whose `enqueue` and `enqueueMany` raise the backend's own failure,
 * so a request that could not enqueue fails rather than reporting work that never runs. One
 * enqueuer serves every request, and each message carries the request's trace.
 *
 * @param queue The backend to write through, the same one the app's dispatcher delivers from.
 * @returns The middleware installing the enqueuer as `ctx.jobs`.
 * @example createRouter({ middleware: [jobEnqueuer(cloudflare.queue(() => env.QUEUE))] });
 */
export function jobEnqueuer(
	queue: JobQueue,
): Middleware<{ key: typeof Jobs; value: JobEnqueuer; property: "jobs" }> {
	let enqueuer = createJobEnqueuer(async (messages) => {
		if (messages.length === 0) return;
		unwrap(await queue.send(messages));
	});

	return (ctx, next) => {
		ctx.set(Jobs, enqueuer, JOBS_PROPERTY);
		return next();
	};
}

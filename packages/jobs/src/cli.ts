/**
 * The middleware an `@sdxc/cli` command line installs to publish `ctx.jobs`, under the key the
 * router entry uses, so a command enqueues a job exactly as a route does. Given the app's
 * dispatcher, it also runs what the command enqueued on a memory queue in the command's process.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandMiddleware } from "@sdxc/cli";

import { currentLog } from "@sdxc/logger";

import type { MemoryQueue } from "./adapters/memory.js";
import type { JobDispatcher } from "./dispatcher.js";
import type { JobEnqueuer } from "./enqueue.js";
import type { JobQueue } from "./queue.js";

import { queueEnqueuer } from "./enqueue.js";
import { Jobs } from "./router.js";

export type { JobEnqueuer } from "./enqueue.js";
export { Jobs } from "./router.js";

const JOBS_PROPERTY = { property: "jobs" } as const;

export namespace JobEnqueuerMiddleware {
	/** How a command runs the jobs it enqueued on a memory queue. */
	export interface Options {
		/**
		 * The app's dispatcher, which runs every job the command enqueued once its handler
		 * settles, with the dispatcher's own middleware, timeout and retry policy. Built over the
		 * same memory queue, the jobs those jobs enqueue run too.
		 */
		dispatcher: Pick<JobDispatcher, "deliver">;
	}

	/** What the middleware publishes. */
	export interface Effect {
		key: typeof Jobs;
		value: JobEnqueuer;
		property: "jobs";
	}
}

/**
 * Runs everything claimable on `queue` through `dispatcher`, round after round, so jobs that
 * the drained jobs enqueue run as well. A job that throws is recorded on its own log and settled
 * as a retry, as a platform would; messages still delayed or backing off once nothing is
 * claimable are recorded as `jobs.pending` on the command's log, since they end with the process.
 */
async function runEnqueued(
	queue: MemoryQueue,
	dispatcher: Pick<JobDispatcher, "deliver">,
	signal: AbortSignal,
): Promise<void> {
	while (!signal.aborted) {
		let settlements = await queue.drain(async (delivery) => {
			try {
				return await dispatcher.deliver(delivery);
			} catch {
				return { type: "retry", delay: undefined };
			}
		});
		if (settlements.length === 0) break;
	}

	let pending = queue.messages.length;
	if (pending > 0) currentLog()?.warn("jobs.pending", { count: pending });
}

/**
 * Publishes `ctx.jobs`, whose `enqueue` and `enqueueMany` write through `queue` and raise the
 * backend's own failure. Each message carries the run's trace.
 *
 * With `options.dispatcher`, the queue is a memory queue and the jobs run in the command's own
 * process once the handler settles, inside the run's log and trace, so their records, failures
 * and retries show where the developer is watching. A run cancelled with Ctrl+C runs none.
 *
 * @param queue The backend to write through: the production queue, or `@sdxc/jobs/memory`'s.
 * @param options The dispatcher that runs what a memory queue holds.
 * @returns The middleware installing the enqueuer as `ctx.jobs`.
 * @example createCLI({ name: "app", commands, middleware: [jobEnqueuer(queue, { dispatcher })] });
 */
export function jobEnqueuer(queue: JobQueue): CommandMiddleware<JobEnqueuerMiddleware.Effect>;
export function jobEnqueuer(
	queue: MemoryQueue,
	options: JobEnqueuerMiddleware.Options,
): CommandMiddleware<JobEnqueuerMiddleware.Effect>;
export function jobEnqueuer(
	queue: JobQueue,
	options?: JobEnqueuerMiddleware.Options,
): CommandMiddleware<JobEnqueuerMiddleware.Effect> {
	let enqueuer = queueEnqueuer(queue);

	return async (ctx, next) => {
		ctx.set(Jobs, enqueuer, JOBS_PROPERTY);
		try {
			await next();
		} finally {
			if (options !== undefined) {
				await runEnqueued(queue as MemoryQueue, options.dispatcher, ctx.signal);
			}
		}
	};
}

/**
 * Builds the dispatcher every job runs through, over a queue that holds its messages in
 * memory. The board runs on a laptop, so a message is enqueued and drained inside the same
 * invocation; swapping this queue for a platform one is the only change a deploy needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobDispatcher, JobDispatcherContext, JobMiddleware } from "@sdxc/jobs";
import type { MemoryQueue } from "@sdxc/jobs/memory";
import type { Database as DataTable } from "remix/data-table";

import { models as publishModels } from "@sdxc/data-model/jobs";
import { createJobDispatcher } from "@sdxc/jobs";
import * as memory from "@sdxc/jobs/memory";

import type { DatabaseEffect } from "~/app/jobs/middleware/database";

import jobs from "~/app/jobs";
import { Database, database } from "~/app/jobs/middleware/database";
import { models } from "~/app/models";
import { logger } from "~/bootstrap/logger";

/** The models a job reads as `ctx.models`, bound to the database the chain opened. */
function modelsMiddleware() {
	return publishModels(models, (ctx) => ({ db: ctx.require(Database) }));
}

/** The dispatcher the board's jobs run through, carrying what its chain publishes. */
export type Dispatcher = JobDispatcher<
	readonly [JobMiddleware<DatabaseEffect>, ReturnType<typeof modelsMiddleware>]
>;

/** A dispatcher and the queue it writes to, so a caller can run what it just enqueued. */
export interface JobRuntime {
	dispatcher: Dispatcher;
	queue: MemoryQueue;
}

declare module "@sdxc/jobs" {
	interface JobTypes {
		context: JobDispatcherContext<Dispatcher>;
	}
}

/**
 * Builds the dispatcher with every handler mapped as a loader, so a module is imported only
 * once a message has matched its job.
 *
 * @param openDatabase Opens the database each job run reads through.
 */
export function createDispatcher(openDatabase: () => DataTable): JobRuntime {
	let queue = memory.queue();

	let dispatcher = createJobDispatcher({
		logger,
		queue,
		middleware: [database(openDatabase), modelsMiddleware()] as const,
		timeout: "30 seconds",
	});

	dispatcher.map(jobs.sendConfirmation, () => import("~/app/jobs/send-confirmation"));
	dispatcher.map(jobs.expirePostings, () => import("~/app/jobs/expire-postings"));

	return { dispatcher, queue };
}

/** Runs every message the queue is holding, and answers once they have all settled. */
export async function drain({ dispatcher, queue }: JobRuntime): Promise<void> {
	await queue.drain((delivery) => dispatcher.deliver(delivery));
}

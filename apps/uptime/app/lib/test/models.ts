/**
 * Uptime's models bound to a test database, the same registry a request binds, so a test seeds
 * and asserts through the code the app runs. Jobs a callback enqueues go through the module
 * enqueuer, onto whatever `QUEUE` the test's `cloudflare:workers` publishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JobEnqueuer } from "@sdxc/jobs";
import type { Database } from "remix/data-table";

import { Models } from "@sdxc/data-model";

import { enqueuer } from "~/app/lib/queue";
import { models } from "~/app/models";

/** A job a test's enqueuer received, by the name its map gives it. */
export interface RecordedJob {
	job: string;
	input: unknown;
}

/**
 * An enqueuer that keeps what it receives in `sent` instead of sending it, for a test that
 * asserts what a write queued, or seeds through models without reaching a queue.
 *
 * @example let { jobs, sent } = recordJobs(); let models = bindModels(db, jobs);
 */
export function recordJobs(): { jobs: JobEnqueuer; sent: RecordedJob[] } {
	let sent: RecordedJob[] = [];
	return {
		sent,
		jobs: {
			async enqueue(job, ...input) {
				sent.push({ job: job.name, input: input[0] });
			},
			async enqueueMany(job, inputs) {
				for (let input of inputs) sent.push({ job: job.name, input });
			},
		},
	};
}

/**
 * Binds every model to `db`.
 *
 * @param db A database from `createTestDatabase()`.
 * @param jobs Where callbacks enqueue, for a test that records the jobs instead.
 * @example let models = bindModels(createTestDatabase().db);
 */
export function bindModels(db: Database, jobs: JobEnqueuer = enqueuer) {
	return models.bind({ db, jobs });
}

/**
 * Publishes the models bound to `db` on a job context a test built by hand, the way the
 * dispatcher's `models()` middleware does for a real run.
 *
 * @param ctx The job context a test created with `createJobContext`.
 * @param db The database the job reads.
 * @param jobs Where callbacks enqueue, for a test that records the jobs instead.
 */
export function publishModels(
	ctx: { set(key: object, value: unknown, options: { property: string }): void },
	db: Database,
	jobs?: JobEnqueuer,
): void {
	ctx.set(Models, bindModels(db, jobs), { property: "models" });
}

/**
 * The two enqueue verbs a producer calls with a job from the map, built over whatever
 * writes messages. The dispatcher and the router middleware both hand theirs out, so a
 * job is addressed and its payload typed identically wherever it is enqueued from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONValue } from "@sdxc/types";
import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { EnqueueArgs, EnqueueInput, JobDefinition } from "./jobs.js";
import type { JobMessage } from "./queue.js";

/** Enqueues jobs from the app's map, each message addressed by the job's own name. */
export interface JobEnqueuer {
	/**
	 * Enqueues one message for a job.
	 * @param job The job, from the app's map.
	 * @param input The payload, typed by that job's own schema.
	 * @example await ctx.jobs.enqueue(jobs.checkHttp, { monitorId: monitor.id });
	 */
	enqueue<Schema extends StandardSchemaV1 | undefined, Meta>(
		job: JobDefinition<Schema, Meta>,
		...input: EnqueueArgs<Schema>
	): Promise<void>;
	/**
	 * Enqueues one message per input, in a single write. Enqueuing nothing does nothing.
	 * @param job The job, from the app's map.
	 * @param inputs One payload per message.
	 */
	enqueueMany<Schema extends StandardSchemaV1 | undefined, Meta>(
		job: JobDefinition<Schema, Meta>,
		inputs: EnqueueInput<Schema>[],
	): Promise<void>;
}

/**
 * Builds both verbs over one write.
 * @param send Writes the messages, raising whatever stopped them from being written.
 */
export function createJobEnqueuer(send: (messages: JobMessage[]) => Promise<void>): JobEnqueuer {
	return {
		async enqueue(job, ...input) {
			await send([{ job: job.name, body: input[0] as JSONValue }]);
		},

		async enqueueMany(job, inputs) {
			await send(inputs.map((input) => ({ job: job.name, body: input as JSONValue })));
		},
	};
}

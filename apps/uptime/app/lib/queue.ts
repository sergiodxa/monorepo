/**
 * Every producer's sends pass through here, where a queue write is billed and one place
 * counts every send. {@link enqueue} and {@link enqueueMany} are what call sites reach
 * for: they take a job from the map, so the payload is typed and the message is addressed
 * from the job's own name. They name the map and nothing else, which keeps the dispatcher,
 * its middleware and every handler loader out of the request path's module graph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobDefinition, JobArgs, JobInput, JobMessage, JobQueue } from "@sdxc/jobs";

import * as cloudflare from "@sdxc/jobs/cloudflare";
import { unwrap } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { recordCost } from "~/app/services/cost";

/**
 * The platform queue underneath, which chunks a batch at the ceiling a single `sendBatch`
 * accepts and refuses a delay longer than one message may be held for.
 */
const platform = cloudflare.queue(() => env.QUEUE);

/**
 * The queue every producer writes through: the platform's, with each write counted. The
 * dispatcher takes this one too, so a send from a request and a send from a cron trigger
 * are billed the same way.
 */
export const jobQueue: JobQueue = {
	...platform,

	async send(messages) {
		recordCost("queueOperation", messages.length);
		return await platform.send(messages);
	},
};

/**
 * Enqueues each message, raising the backend's own failure. Sending nothing is a no-op.
 *
 * @param messages - One entry per message, each addressed to the job it is for.
 */
export async function sendMessages(messages: JobMessage[]): Promise<void> {
	if (messages.length === 0) return;
	unwrap(await jobQueue.send(messages));
}

/**
 * Enqueues one message for a job, counted as the single queue write it is billed as. The
 * matching read and delete are charged to the consumer that receives it.
 *
 * @param job - The job to run, from the app's job map.
 * @param input - Its payload, typed by that job's own schema.
 * @example await enqueue(jobs.verifyDomainOwnership, { teamDomainId: domain.id });
 */
export async function enqueue<Definition extends AnyJobDefinition>(
	job: Definition,
	...input: JobArgs<Definition>
): Promise<void> {
	await sendMessages([{ job: job.name, body: input[0] as JobMessage["body"] }]);
}

/**
 * Enqueues one message per input for a job, in a single write.
 *
 * @param job - The job to run, from the app's job map.
 * @param inputs - One payload per message.
 * @example await enqueueMany(jobs.checkHttp, due.map((monitor) => ({ monitorId: monitor.id })));
 */
export async function enqueueMany<Definition extends AnyJobDefinition>(
	job: Definition,
	inputs: JobInput<Definition>[],
): Promise<void> {
	await sendMessages(inputs.map((input) => ({ job: job.name, body: input as JobMessage["body"] })));
}

/**
 * Every producer's sends pass through here, where a queue write is billed and one place
 * counts every send. {@link enqueue} and {@link enqueueMany} are what call sites reach
 * for: they take a job from the map, so the payload is typed and the message `type` comes
 * from the job's own name. They name the map and nothing else, which keeps the dispatcher,
 * its middleware and every handler loader out of the request path's module graph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyJobDefinition, JobArgs, JobInput } from "@sdxc/jobs";

import { messageBody } from "@sdxc/jobs";
import { env } from "cloudflare:workers";

import { chunk } from "~/app/lib/concurrency";
import { recordCost } from "~/app/services/cost";

/** Most messages Cloudflare Queues accepts in a single `sendBatch` call. */
const QUEUE_BATCH_LIMIT = 100;

/**
 * Enqueues many messages, in as many requests as {@link QUEUE_BATCH_LIMIT} needs.
 * Sending nothing is a no-op — an empty list passes through safely.
 *
 * @param bodies - One message body per message, each naming the job it is for.
 */
export async function sendQueueBatch(bodies: unknown[]): Promise<void> {
	recordCost("queueOperation", bodies.length);

	for (let batch of chunk(bodies, QUEUE_BATCH_LIMIT)) {
		await env.QUEUE.sendBatch(batch.map((body) => ({ body, contentType: "json" })));
	}
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
	await sendQueueBatch([messageBody(job, input[0])]);
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
	if (inputs.length === 0) return;
	await sendQueueBatch(inputs.map((input) => messageBody(job, input)));
}

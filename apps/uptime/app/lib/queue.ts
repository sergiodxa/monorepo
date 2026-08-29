/**
 * Every producer's sends pass through here, where a queue write is billed and
 * one place counts every send. Bodies stay typed `unknown` because the
 * worker's `queue` handler validates the message schema on the consumer side,
 * where every delivery already passes through it — a type here would just be a
 * second contract to keep in sync.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

import { chunk } from "~/app/lib/concurrency";
import { recordCost } from "~/app/services/cost";

/** Most messages Cloudflare Queues accepts in a single `sendBatch` call. */
const QUEUE_BATCH_LIMIT = 100;

/**
 * Enqueues one message, counted as the single queue write it is billed as. The matching
 * read and delete are charged to the consumer that receives it.
 *
 * @param body - The message body, matching one variant of the worker's message schema.
 */
export async function sendQueueMessage(body: unknown): Promise<void> {
	recordCost("queueOperation");
	await env.QUEUE.send(body, { contentType: "json" });
}

/**
 * Enqueues many messages, in as many requests as {@link QUEUE_BATCH_LIMIT} needs.
 * Sending nothing is a no-op — an empty list passes through safely.
 *
 * @param bodies - One message body per message, matching the worker's message schema.
 */
export async function sendQueueBatch(bodies: unknown[]): Promise<void> {
	recordCost("queueOperation", bodies.length);

	for (let batch of chunk(bodies, QUEUE_BATCH_LIMIT)) {
		await env.QUEUE.sendBatch(batch.map((body) => ({ body, contentType: "json" })));
	}
}

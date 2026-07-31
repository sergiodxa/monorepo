/**
 * The two ways this app puts work on its queue: one message, or a batch of them split into
 * requests the queue accepts. Every producer goes through here rather than reaching for the
 * binding, because a queue write is billed and therefore has to be counted, and one place
 * that knows "a send is one queue operation" beats fifteen that each have to remember.
 *
 * Bodies are typed `unknown` on purpose. The message contract is the `variant` schema the
 * worker's `queue` handler validates against — a producer that spells a message wrong is
 * caught there, on the consumer side where every delivery passes through it, and a type here
 * would only be a second copy of that contract to keep in sync.
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
 * Enqueues many messages, in as many requests as {@link QUEUE_BATCH_LIMIT} needs. Sending
 * nothing is a no-op, so callers don't have to guard an empty result.
 *
 * @param bodies - One message body per message, matching the worker's message schema.
 */
export async function sendQueueBatch(bodies: unknown[]): Promise<void> {
	recordCost("queueOperation", bodies.length);

	for (let batch of chunk(bodies, QUEUE_BATCH_LIMIT)) {
		await env.QUEUE.sendBatch(batch.map((body) => ({ body, contentType: "json" })));
	}
}

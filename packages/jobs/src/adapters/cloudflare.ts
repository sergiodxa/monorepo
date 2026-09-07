/**
 * The Cloudflare backend: the queue a dispatcher enqueues through, and the two worker
 * handlers it is delivered from. Everything in this package that names a `Message`, a
 * `MessageBatch` or a `ScheduledController` is here, so the rest of it names no platform.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Message, MessageBatch, Queue, ScheduledController } from "@cloudflare/workers-types";
import type { Result } from "@sdxc/result";

import { toSeconds } from "@sdxc/duration";
import { failure, success } from "@sdxc/result";

import type { JobDispatcher } from "../dispatcher.js";
import type { JobDelivery, JobMessage, JobQueue, Settlement } from "../queue.js";

import { envelope } from "../jobs.js";
import { JobQueueError } from "../queue.js";

/** Most messages a single `sendBatch` accepts. */
const BATCH_LIMIT = 100;

/** Longest a message is held before its first delivery. */
const MAX_DELAY_SECONDS = 43_200;

/** What {@link worker} needs of a dispatcher: the batch entry, and the tick. */
export type JobWorkerTarget = Pick<JobDispatcher, "deliverBatch" | "tick">;

/** The two handlers a worker delegates its cron and queue deliveries to. */
export interface WorkerHandlers {
	queue(batch: MessageBatch<unknown>): Promise<void>;
	scheduled(controller: ScheduledController): Promise<void>;
}

/** One message as a delivery, with the platform's own id and attempt count. */
function deliveryOf(message: Message<unknown>): JobDelivery {
	return {
		id: message.id,
		attempts: message.attempts,
		body: message.body,
		enqueuedAt: message.timestamp,
	};
}

/**
 * Settles one message the way the run asked. A dead-lettered delivery is acked, because this
 * platform's dead-letter queue is reached by exhausting retries rather than by asking, and a
 * refused body has already been forwarded by the dispatcher.
 *
 * @param message The delivery to settle.
 * @param settlement What the run ended as.
 */
function apply(message: Message<unknown>, settlement: Settlement): void {
	if (settlement.type === "retry") {
		let delay = settlement.delay;
		message.retry(delay === undefined ? {} : { delaySeconds: toSeconds(delay) });
		return;
	}

	message.ack();
}

/**
 * The queue a dispatcher enqueues through.
 *
 * Retries are the platform's: the ceiling and the dead-letter queue are one policy per queue
 * in `wrangler.jsonc`, so nothing here counts attempts of its own.
 *
 * @param binding Resolves the queue binding per call, so importing a dispatcher touches none.
 * @example createJobDispatcher({ queue: cloudflare.queue(() => env.QUEUE) });
 */
export function queue(binding: () => Queue): JobQueue {
	return {
		retries: "backend",

		async send(messages: JobMessage[]): Promise<Result<void, JobQueueError>> {
			for (let message of messages) {
				if (message.delay === undefined) continue;
				if (toSeconds(message.delay) <= MAX_DELAY_SECONDS) continue;

				return failure(
					new JobQueueError(`A message cannot be held longer than ${MAX_DELAY_SECONDS} seconds`, {
						code: "unsupported_delay",
					}),
				);
			}

			try {
				let target = binding();

				for (let start = 0; start < messages.length; start += BATCH_LIMIT) {
					await target.sendBatch(
						messages.slice(start, start + BATCH_LIMIT).map((message) => ({
							body: envelope(message.job, message.body),
							contentType: "json",
							delaySeconds: message.delay === undefined ? undefined : toSeconds(message.delay),
						})),
					);
				}

				return success(undefined);
			} catch (error) {
				return failure(
					new JobQueueError("The queue refused the write", {
						code: "unavailable",
						cause: error instanceof Error ? error : undefined,
					}),
				);
			}
		},
	};
}

/**
 * The worker handlers for a dispatcher: a cron delivery becomes the tick for that trigger's
 * own expression, and a queue delivery becomes one batch of deliveries settled as each
 * finishes.
 *
 * Typed by the two methods it calls rather than by the dispatcher's middleware chain, which
 * it has no part in.
 *
 * @param dispatcher The dispatcher both handlers delegate to.
 * @example export default { ...cloudflare.worker(dispatcher) };
 */
export function worker(dispatcher: JobWorkerTarget): WorkerHandlers {
	return {
		async queue(batch) {
			let deliveries = batch.messages.map(deliveryOf);
			let messages = new Map(batch.messages.map((message) => [message.id, message]));

			await dispatcher.deliverBatch(deliveries, {
				queue: batch.queue,
				apply(delivery, settlement) {
					let message = messages.get(delivery.id);
					if (message !== undefined) apply(message, settlement);
				},
			});
		},

		async scheduled(controller) {
			/**
			 * The trigger's expression is a plain string here and a five-field one in a
			 * declaration, and the platform is the authority on which minute this is: `tick`
			 * compares it against what each job declared rather than evaluating it.
			 */
			await dispatcher.tick({
				now: new Date(controller.scheduledTime),
				only: controller.cron as Parameters<JobWorkerTarget["tick"]>[0]["only"],
			});
		},
	};
}

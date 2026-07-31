/**
 * Consumer for the `ping-dlq` dead-letter queue (ADR-018): logs the message and acks it.
 *
 * Recording is all it does. Re-running the work would reinvent the retry loop the message
 * has already been through, and a lost check can't be performed late anyway — the interval
 * it belonged to has passed.
 *
 * It doesn't extend `Job` because `Job.run` re-throws an error it doesn't recognise so the
 * platform can retry the message, and a dead-letter queue has no dead-letter queue of its
 * own: an unacked message keeps coming back until it ages out of retention, and a backed-up
 * DLQ drops the failures it exists to preserve. Hence the ack in a `finally`, and nothing
 * here that can throw.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BatchedLogger } from "@pkg/logger";

export class DeadLetterJob {
	/** @param message The dead-lettered message to record and ack. */
	static run(message: Message<unknown>): void {
		/**
		 * Same `job:<kebab-case class name>:<message id>` identifier `Job.run` derives, so
		 * dead-letter records filter alongside the jobs they came from — worth having when a
		 * D1 outage puts thousands of them in the log at once.
		 */
		let logger = new BatchedLogger(`job:dead-letter-job:${message.id}`);
		let body = message.body;

		try {
			/**
			 * Two kinds of failure land here and the wrapper is the only difference. The queue
			 * handler forwards a body that failed schema validation as `{ invalid: <body> }`;
			 * a message that exhausted its retries is dead-lettered by the platform with its
			 * body verbatim. `attempts` counts deliveries of this DLQ copy either way, not the
			 * retries that spent the original.
			 */
			if (typeof body === "object" && body !== null && "invalid" in body) {
				logger.error("job.dead_letter.invalid_message", {
					id: message.id,
					attempts: message.attempts,
					body: body.invalid,
				});
			} else {
				logger.error("job.dead_letter.retries_exhausted", {
					id: message.id,
					attempts: message.attempts,
					/** The job that never ran, lifted out of the body so it can be grouped on. */
					type: typeof body === "object" && body !== null && "type" in body ? body.type : null,
					body,
				});
			}
		} finally {
			message.ack();
			logger.flush();
		}
	}
}

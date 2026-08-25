/**
 * Consumer for the `ping-dlq` dead-letter queue (ADR-018): logs the message and acks it.
 *
 * A message here already spent its retries and its check interval has passed, so
 * recording it is the whole job. Acking happens in a `finally` block, keeping the
 * queue drained even when the message body fails to parse.
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
			 * The queue handler wraps a body that failed validation as `{ invalid: <body> }`; a
			 * message that exhausted its retries arrives dead-lettered by the platform verbatim.
			 * `attempts` counts deliveries of this DLQ copy, not the retries that spent the original.
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

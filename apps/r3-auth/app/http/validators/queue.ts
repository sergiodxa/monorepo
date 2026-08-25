/**
 * Schema for the messages this worker consumes off its queue. A message body is a
 * contract with whatever already enqueued it — a body written by an earlier deploy can
 * still be in flight — so the `type` strings here are as frozen as any HTTP payload,
 * and a body matching nothing is refused rather than guessed at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

/**
 * Every queue message type the worker understands, discriminated by `type`. One
 * member today: the daily session sweep the cron trigger enqueues, carrying no payload
 * so a redelivery of the same body is idempotent.
 */
export const QueueMessageSchema = s.variant("type", {
	cleanExpiredSessions: s.object({
		/**
		 * The type argument is explicit because `literal` would otherwise widen to
		 * `string` and stop discriminating.
		 */
		type: s.literal<"cleanExpiredSessions">("cleanExpiredSessions"),
	}),
});

/** A validated queue message body. */
export type QueueMessage = s.InferOutput<typeof QueueMessageSchema>;

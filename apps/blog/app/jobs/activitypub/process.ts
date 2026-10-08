/**
 * Runs one step of federation: processes an activity the inbox verified, fans a published
 * activity out to its inboxes, or signs and POSTs one delivery. Every step the federation
 * queues arrives here, so retries and acknowledgements follow one rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";

/**
 * A failure the next attempt can change (a remote server, a store, the queue) retries after
 * the federation's backoff, or later when an inbox's `Retry-After` asks; anything else is
 * acknowledged. The attempt is passed on, so a retry is never mistaken for a redelivery.
 */
export default createJobHandler(jobs.activityPub.process, async (ctx) => {
	ctx.log.set({ activitypub: { kind: ctx.input.kind } });

	let processed = await ctx.activityPub.process(ctx.input, { attempts: ctx.attempts });
	if (isFailure(processed)) {
		let error = processed.error;
		ctx.log.set({ activitypub: { failure: error.code, retryable: error.retryable } });
		if (error.retryable) return ctx.retry({ delay: error.delay, cause: error });
		return ctx.ack(error.message);
	}

	ctx.log.set({ activitypub: { ...processed.data } });
});

import { createBackoff } from "@sdxc/backoff";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { WebmentionFetchError } from "@sdxc/webmention";
import { send } from "@sdxc/webmention/sender";

import jobs from "~/app/jobs";
/**
 * Delivers one Webmention: discovers the target's endpoint and notifies it that the
 * post links to it, or no longer does. The endpoint's answer is recorded so the next
 * change to the post knows what it notified.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { findForMentions } from "~/app/services/posts";
import { permalink, USER_AGENT } from "~/app/services/webmention";

/**
 * The wait before redelivering after a transient failure: quick while a receiver
 * may be briefly down, then doubling, so one that stays down is left alone.
 */
const retryBackoff = createBackoff({ base: "5 minutes", max: "6 hours", jitter: 0.2 });

/**
 * A timeout, network failure, 5xx or 429 retries later; any other refusal is recorded
 * and acknowledged. A removed link's record is dropped once its target has been told,
 * or once telling it is no longer possible.
 */
export default createJobHandler(jobs.webmentions.deliver, async (ctx) => {
	let post = await findForMentions(ctx.models, ctx.input.postId);
	if (!post) return ctx.ack("The post no longer exists");

	let { postId, removed, target } = ctx.input;
	ctx.log.set({ webmention: { post: postId, target, removed } });

	let result = await send(
		{ source: permalink(post), target: new URL(target) },
		{ userAgent: USER_AGENT },
	);

	if (isFailure(result)) {
		let error = result.error;
		let transient =
			error instanceof WebmentionFetchError
				? error.retryable
				: error.status >= 500 || error.status === 429;
		if (transient) return ctx.retry({ delay: retryBackoff.delay(ctx.attempts), cause: error });

		if (removed) await ctx.models.webmentionSends.forget(postId, target);
		else {
			await ctx.models.webmentionSends.record(postId, target, {
				status: "failed",
				endpoint: null,
				code: error instanceof WebmentionFetchError ? null : error.status,
				location: null,
			});
		}
		return ctx.ack(error.message);
	}

	let delivery = result.data;
	ctx.log.set({ webmention: { delivery: delivery.status } });

	if (removed) return await ctx.models.webmentionSends.forget(postId, target);

	await ctx.models.webmentionSends.record(
		postId,
		target,
		delivery.status === "sent"
			? {
					status: "sent",
					endpoint: delivery.endpoint.href,
					code: delivery.code,
					location: delivery.location,
				}
			: { status: "no-endpoint", endpoint: null, code: null, location: null },
	);
});

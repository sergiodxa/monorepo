/**
 * Verifies one received Webmention: fetches the source under bounds and stores the
 * mention it now is, updates it, or marks it deleted. Runs off the request, so the
 * anonymous endpoint never makes the blog fetch a URL while its caller waits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createBackoff } from "@sdxc/backoff";
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { verify } from "@sdxc/webmention/receiver";

import jobs from "~/app/jobs";
import { Post } from "~/app/repositories/post";
import { USER_AGENT } from "~/app/services/webmention";

/**
 * The wait before re-fetching a source after a transient failure: quick at first,
 * then doubling, so a source that stays down is left alone.
 */
const retryBackoff = createBackoff({ base: "2 minutes", max: "1 hour", jitter: 0.2 });

/**
 * A source that fails transiently (timeout, 5xx, 429) is retried later; one refused
 * for good is acknowledged. A blocked host is dropped, an allowlisted host's mention is
 * approved on arrival, and everyone else's waits for moderation.
 */
export default createJobHandler(jobs.webmentions.verify, async (ctx) => {
	let pair = { source: new URL(ctx.input.source), target: new URL(ctx.input.target) };
	ctx.log.set({ webmention: { source: pair.source.href, target: pair.target.href } });

	let post = await Post.findMentionable(ctx.db, pair.target, pair.target.origin);
	if (!post) {
		await ctx.models.webmentions.markDeleted(pair);
		return ctx.ack("The target no longer takes mentions");
	}

	let policy = await ctx.models.webmentionDomains.policyFor(pair.source.hostname);
	if (policy === "block") return ctx.ack("The source host is blocked");

	let outcome = await verify(pair, { userAgent: USER_AGENT });
	if (isFailure(outcome)) {
		if (outcome.error.retryable)
			return ctx.retry({ delay: retryBackoff.delay(ctx.attempts), cause: outcome.error });
		return ctx.ack(outcome.error.message);
	}

	ctx.log.set({ webmention: { outcome: outcome.data.status } });

	if (outcome.data.status !== "linked") {
		await ctx.models.webmentions.markDeleted(pair);
		return;
	}

	let stored = await ctx.models.webmentions.record({
		postId: post.id,
		pair,
		mention: outcome.data.mention,
		status: policy === "allow" ? "approved" : "pending",
	});
	ctx.log.set({ webmention: { id: stored.id, status: stored.status, kind: stored.kind } });
});

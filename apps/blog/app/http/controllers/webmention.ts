/**
 * The Webmention endpoint: accepts a mention of a published article or tutorial on
 * this site and queues its verification. Nothing is fetched during the request, so an
 * anonymous POST can never make the blog fetch a URL on its sender's schedule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { accepted, parseRequest, rejected } from "@sdxc/webmention/receiver";
import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import { findMentionable } from "~/app/services/posts";
import routes from "~/routes/web";

/**
 * Answers `400` for everything the specification rejects (wrong media type, missing
 * or private URLs, source equal to target, a target that is not a published post here)
 * and `202` otherwise. A blocked source host gets the same `202` and is never queued.
 */
export default createAction(routes.webmention, async (ctx) => {
	let parsed = await parseRequest(ctx.request, {
		formData: ctx.get(FormData),
		accepts: async (target) => (await findMentionable(ctx.models, target, ctx.url.origin)) !== null,
	});
	if (isFailure(parsed)) {
		ctx.log.set({ webmention: { rejected: parsed.error.reason } });
		return rejected(parsed.error);
	}

	let { source, target } = parsed.data;
	if ((await ctx.models.webmentionDomains.policyFor(source.hostname)) === "block") {
		ctx.log.set({ webmention: { dropped: source.hostname } });
		return accepted();
	}

	await ctx.jobs.enqueue(jobs.webmentions.verify, { source: source.href, target: target.href });
	return accepted();
});

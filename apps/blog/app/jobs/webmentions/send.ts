/**
 * Plans what a post notifies after it was created, updated or deleted: every page its
 * content links to now, plus every page it notified before and no longer links to, and
 * queues one delivery per target so a slow endpoint delays nobody else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";
import { Markdown } from "@sdxc/markdown";
import { toHTML } from "@sdxc/markdown/html";
import { isFailure } from "@sdxc/result";
import { outboundLinks, plan } from "@sdxc/webmention/sender";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { Post } from "~/app/repositories/post";
import { permalink } from "~/app/services/webmention";

/**
 * The pages a post's Markdown links to once rendered, other sites only; a source that
 * no longer parses links nowhere.
 */
function linksOf(content: string, source: URL): URL[] {
	let parsed = Markdown.parse(content);
	if (isFailure(parsed)) return [];
	return outboundLinks(toHTML(parsed.data.document), source);
}

/**
 * A post still in preview sends nothing: the scheduled job sends it once its publish
 * date arrives. A deleted post notifies every target it had, which then reads its 410.
 */
export default createJobHandler(jobs.webmentions.send, async (ctx) => {
	let post = await Post.findForMentions(ctx.db, ctx.input.postId);
	if (!post) return ctx.ack("The post has no permalink to send from");

	let deleted = post.deleted_at !== null;
	if (!deleted && !Post.isPublishedAt(post.published_at)) {
		return ctx.ack("The post is not published yet");
	}

	let source = permalink(post);
	let current = deleted ? [] : linksOf(post.content, source);
	let previous = await ctx.models.webmentionSends.targetsFor(post.id);
	let { targets } = plan(current, previous);
	let linked = new Set(current.map((url) => url.href));

	await dispatcher.enqueueMany(
		jobs.webmentions.deliver,
		targets.map((target) => ({
			postId: post.id,
			target: target.href,
			removed: !linked.has(target.href),
		})),
	);
	if (!deleted) await Post.markMentionsSent(ctx.db, post.id);

	ctx.log.set({ webmention: { post: post.id, targets: targets.length, deleted } });
});

/**
 * Federates a post after it was created, edited, deleted or reached its publish date:
 * works out which activity that is for its followers and publishes it, carrying the
 * activity whole so every inbox receives the same bytes even if the post changes again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ActivityPub } from "@sdxc/activitypub";

import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { Post } from "~/app/repositories/post";
import { create, remove, update } from "~/app/services/federated-posts";

/**
 * A post followers never received is a `Create`, one they did an `Update` named by
 * `changedAt`, and a deleted one they received a `Delete`. A preview, a post deleted
 * before it federated, and anything but an article or tutorial send nothing. The post is
 * stamped federated only once its fan-out is queued, so a failed publish retries a `Create`.
 */
export default createJobHandler(jobs.activityPub.publish, async (ctx) => {
	let source = await Post.findForMentions(ctx.db, ctx.input.postId);
	if (source === null) return ctx.ack("The post is not an article or tutorial");

	let federated = source.federated_at !== null;
	ctx.log.set({ activitypub: { post: source.id, federated } });

	let activity: ActivityPub.Draft<ActivityPub.Activity>;
	if (source.deleted_at !== null) {
		if (!federated) return ctx.ack("The post was deleted before it federated");
		activity = remove(source);
	} else {
		if (!Post.isPublishedAt(source.published_at)) return ctx.ack("The post is not published yet");

		let post = await Post.findByTypeAndSlug(ctx.db, {
			postType: source.postType,
			postSlug: source.slug,
		});
		if (post === null) return ctx.ack("The post has no public page");

		let changedAt = new Date(ctx.input.changedAt);
		if (Number.isNaN(changedAt.getTime())) return ctx.ack("The change time is not a date");

		activity = federated ? update(post, changedAt) : create(post);
	}

	let published = await ctx.activityPub.publish(activity);
	if (isFailure(published)) {
		if (published.error.retryable) return ctx.retry({ cause: published.error });
		return ctx.ack(published.error.message);
	}

	if (!federated) await Post.markFederated(ctx.db, source.id);
	ctx.log.set({ activitypub: { activity: activity.type } });
});

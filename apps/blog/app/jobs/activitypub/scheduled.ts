/**
 * Federates posts published on a schedule: a future publish date makes a post visible on
 * read, with no request to hook, so this cron finds the posts whose date has arrived and
 * whose followers never received them, and queues each one's publish.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { Post } from "~/app/repositories/post";

/**
 * Only queues: each publish stamps its post once its fan-out is queued, so a post queued
 * twice before that sends the same `Create` id twice, which receivers absorb.
 */
export default createJobHandler(jobs.activityPub.scheduled, async (ctx) => {
	let due = await Post.findDueForFederation(ctx.db);
	let changedAt = new Date().toISOString();
	await dispatcher.enqueueMany(
		jobs.activityPub.publish,
		due.map((postId) => ({ postId, changedAt })),
	);
	ctx.log.set({ activitypub: { due: due.length } });
});

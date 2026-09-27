/**
 * Sends the Webmentions of posts published on a schedule: a future publish date makes
 * a post visible on read, with no request to hook, so this cron finds the posts whose
 * date has arrived since they last sent and queues each one's send.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { Post } from "~/app/repositories/post";

/**
 * Only queues: each send stamps its post, so a post queued twice before its send runs
 * plans the same targets, which receivers treat as an update of the same mention.
 */
export default createJobHandler(jobs.webmentions.scheduled, async (ctx) => {
	let due = await Post.findDueForMentions(ctx.db);
	await dispatcher.enqueueMany(
		jobs.webmentions.send,
		due.map((postId) => ({ postId })),
	);
	ctx.log.set({ webmention: { due: due.length } });
});

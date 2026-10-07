/**
 * The weekly bookmark check: queues one inspection per bookmark, so a slow origin delays
 * nobody else and each bookmark's outcome is recorded on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { LikePost } from "~/app/repositories/posts/like";

/**
 * Only queues; a bookmark linking within the site has no other site to check and is left
 * out, which is the same test the inspection applies.
 */
export default createJobHandler(jobs.bookmarks.sweep, async (ctx) => {
	let bookmarks = await LikePost.findAll(ctx.db);
	let external = bookmarks.filter((bookmark) =>
		/^https?:\/\//i.test(LikePost.normalizeUrl(bookmark.meta.url)),
	);

	await dispatcher.enqueueMany(
		jobs.bookmarks.inspect,
		external.map((bookmark) => ({ postId: bookmark.id })),
	);
	ctx.log.set({ bookmarks: { inspecting: external.length } });
});

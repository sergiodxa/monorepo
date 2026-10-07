/**
 * The weekly bookmark check: queues one inspection per bookmark, so a slow origin delays
 * nobody else, and one archive per bookmark still without a Wayback Machine capture whose
 * last attempt is a month old, which also backfills the bookmarks saved before archiving.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { dispatcher } from "~/app/jobs/dispatcher";
import { Bookmark } from "~/app/repositories/bookmark";
import { LikePost } from "~/app/repositories/posts/like";

/** How long a bookmark the archive could not capture waits before it is tried again. */
const ARCHIVE_RETRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Only queues; a bookmark linking within the site has no other site to check and is left
 * out, which is the same test the inspection applies.
 */
export default createJobHandler(jobs.bookmarks.sweep, async (ctx) => {
	let bookmarks = await LikePost.findAll(ctx.db);
	let external = bookmarks.filter((bookmark) =>
		/^https?:\/\//i.test(LikePost.normalizeUrl(bookmark.meta.url)),
	);

	let records = await Bookmark.findAll(ctx.db);
	let retryBefore = new Date(Date.now() - ARCHIVE_RETRY_MS).toISOString();
	let unarchived = external.filter((bookmark) => {
		if (bookmark.meta.archived_at !== "") return false;
		let attempted = records.get(bookmark.id)?.archive_attempted_at ?? null;
		return attempted === null || attempted < retryBefore;
	});

	await dispatcher.enqueueMany(
		jobs.bookmarks.inspect,
		external.map((bookmark) => ({ postId: bookmark.id })),
	);
	await dispatcher.enqueueMany(
		jobs.bookmarks.archive,
		unarchived.map((bookmark) => ({ postId: bookmark.id })),
	);
	ctx.log.set({ bookmarks: { inspecting: external.length, archiving: unarchived.length } });
});

/**
 * Takes a bookmark's Wayback Machine capture and records its instant as `archived_at`,
 * which the Wayback link on `/bookmarks` opens. A new bookmark is captured as saved; one
 * saved more than a week ago first takes the closest capture the archive already holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import jobs from "~/app/jobs";
import { Bookmark } from "~/app/repositories/bookmark";
import { LikePost } from "~/app/repositories/posts/like";
import { captureStatus, closestCapture, requestCapture, waybackKeys } from "~/app/services/wayback";

/** How old a bookmark is before an existing capture counts as its archive. */
const BACKFILL_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A capture takes a minute or so, so the job stores the capture's id and retries itself to
 * read it, instead of waiting inside one run. A rate limit or an outage retries later; a
 * capture the archive refuses is recorded as an attempt, which the weekly check repeats
 * after thirty days.
 */
export default createJobHandler(jobs.bookmarks.archive, async (ctx) => {
	let bookmark = await LikePost.findById(ctx.db, ctx.input.postId);
	if (!bookmark) return ctx.ack("The bookmark no longer exists");

	let url = LikePost.normalizeUrl(bookmark.meta.url);
	if (!/^https?:\/\//i.test(url)) return ctx.ack("The bookmark links within the site");

	let record = await Bookmark.findByPostId(ctx.db, bookmark.id);
	if (!record) return ctx.ack("The bookmark has no record yet");

	if (record.archive_job) {
		let keys = waybackKeys();
		if (!keys) return ctx.exit("The worker has no Wayback Machine keys");

		let status = await captureStatus(record.archive_job, keys);
		if (isFailure(status)) {
			if (status.error.retryable) ctx.retry({ delay: "5 minutes", cause: status.error });
			await Bookmark.archived(ctx.db, bookmark.id);
			return ctx.exit(status.error.message);
		}

		let capture = status.data;
		if (capture.state === "pending") return ctx.retry({ delay: "1 minute" });
		if (capture.state === "failed") {
			await Bookmark.archived(ctx.db, bookmark.id);
			return ctx.exit(`The archive could not capture the page: ${capture.reason}`);
		}

		await LikePost.update(ctx.db, bookmark.id, { meta: { archived_at: capture.at } });
		await Bookmark.archived(ctx.db, bookmark.id);
		return void ctx.log.set({ bookmark: { id: bookmark.id, archived: capture.at } });
	}

	if (Date.now() - Date.parse(bookmark.created_at) > BACKFILL_AFTER_MS) {
		let closest = await closestCapture(url, bookmark.created_at);
		if (isFailure(closest) && closest.error.retryable) {
			ctx.retry({ delay: "5 minutes", cause: closest.error });
		}
		if (!isFailure(closest) && closest.data) {
			await LikePost.update(ctx.db, bookmark.id, { meta: { archived_at: closest.data } });
			await Bookmark.archived(ctx.db, bookmark.id);
			return void ctx.log.set({ bookmark: { id: bookmark.id, archived: closest.data } });
		}
	}

	let keys = waybackKeys();
	if (!keys) return ctx.exit("The worker has no Wayback Machine keys");

	let job = await requestCapture(url, keys);
	if (isFailure(job)) {
		if (job.error.retryable) ctx.retry({ delay: "5 minutes", cause: job.error });
		await Bookmark.archived(ctx.db, bookmark.id);
		return ctx.exit(job.error.message);
	}

	await Bookmark.archiving(ctx.db, bookmark.id, job.data);
	ctx.retry({ delay: "1 minute" });
});

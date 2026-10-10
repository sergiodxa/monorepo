import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
/**
 * Reads one bookmarked page and records what it came to: the weekly check of every
 * bookmark, and the second try for a bookmark whose page could not be read when it was
 * saved. A healthy page also fills a title or description the bookmark is missing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { raises } from "~/app/models/bookmarks";
import { bookmarkAddress, normalizeUrl } from "~/app/models/post-values";
import { readBookmarkPage } from "~/app/services/bookmark-page";
import { robotsFor } from "~/app/services/bookmark-robots";

/** How long one inspection waits on a page; nobody is waiting, so slower origins get a chance. */
const INSPECT_TIMEOUT_MS = 10_000;

/**
 * A `moved` or `gone` the bookmark is not already flagged for is read again twelve hours
 * later and recorded only when the second read agrees, so an outage that passes overnight
 * never reaches the inbox. Every other reading is recorded at once.
 */
export default createJobHandler(jobs.bookmarks.inspect, async (ctx) => {
	let bookmark = await ctx.models.likes.find(ctx.input.postId);
	if (!bookmark) return ctx.ack("The bookmark no longer exists");

	let url = normalizeUrl(bookmark.meta.url);
	if (!/^https?:\/\//i.test(url) || !URL.canParse(url)) {
		return ctx.ack("The bookmark has no address on another site to read");
	}

	let record = await ctx.models.bookmarks.find(bookmark.id);
	if (!record && !(await ctx.models.bookmarks.claim(bookmark.id, bookmarkAddress(url), null))) {
		return ctx.ack("Another bookmark holds this address");
	}

	let robots = await robotsFor(new URL(url));
	let reading = await readBookmarkPage(url, {
		timeout: INSPECT_TIMEOUT_MS,
		robots,
		signal: ctx.signal,
	});
	ctx.log.set({ bookmark: { id: bookmark.id, status: reading.status, http: reading.httpStatus } });

	if (raises(record, reading) && ctx.attempts === 1) {
		ctx.retry({ delay: "12 hours" });
	}

	await ctx.models.bookmarks.record(bookmark.id, reading);

	if (reading.status !== "ok") return;

	let title = bookmark.meta.title.trim() === "" ? reading.title : null;
	let description = bookmark.meta.description.trim() === "" ? reading.description : null;
	if (title || description) {
		await ctx.models.likes.update(bookmark.id, {
			meta: { ...(title ? { title } : {}), ...(description ? { description } : {}) },
		});
	}
	await ctx.models.bookmarks.described(bookmark.id);
});

/**
 * Mails the bookmarks flagged since the last digest. It runs daily and sends nothing when
 * nothing is new, so mail follows the weekly check, and a failed send is retried before
 * any flag is marked reported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Address } from "@sdxc/mail";

import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";

import emails from "~/app/emails";
import jobs from "~/app/jobs";
import { flagOf } from "~/app/models/bookmarks";
import { bookmarkLabel } from "~/app/models/post-values";
import routes from "~/routes/web";

/** Who reviews flagged bookmarks. */
export const DIGEST_RECIPIENT: Address = { email: "hello@sergiodxa.com" };

/** The site the CMS links in a digest point at, so they open from any mail client. */
const SITE = "https://sergiodxa.com";

/**
 * A send that fails, including on a worker without an email binding, retries the run and
 * leaves every flag unreported, so a later run mails it.
 */
export default createJobHandler(jobs.bookmarks.digest, async (ctx) => {
	let records = await ctx.models.bookmarks.findUnreported();
	if (records.length === 0) return ctx.ack("No new flags");

	let items = [];
	for (let record of records) {
		let bookmark = await ctx.models.likes.find(record.post_id);
		let flag = flagOf(record);
		if (!bookmark || flag === null) continue;
		items.push({
			title: bookmarkLabel(bookmark.meta),
			url: bookmark.meta.url,
			flag,
			httpStatus: record.http_status,
			finalUrl: record.final_url,
			editUrl: new URL(routes.cms.bookmarks.edit.href({ id: bookmark.id }), SITE).href,
		});
	}
	if (items.length === 0) return ctx.ack("Every flagged bookmark was deleted");

	let sent = await ctx.email.send(emails.bookmarks.digest, {
		to: DIGEST_RECIPIENT,
		props: { items },
	});
	if (isFailure(sent)) ctx.retry({ delay: "1 hour", cause: sent.error });

	await ctx.models.bookmarks.reported(
		records.map((record) => record.post_id),
		new Date().toISOString(),
	);
	ctx.log.set({ bookmarks: { reported: items.length } });
});

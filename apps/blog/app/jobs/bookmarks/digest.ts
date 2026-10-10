import type { Address } from "@sdxc/mail";

import { createJobHandler } from "@sdxc/jobs";
import { Mailer } from "@sdxc/mail";
import { isFailure } from "@sdxc/result";

import { BookmarksDigestEmail } from "~/app/emails/bookmarks-digest";
import jobs from "~/app/jobs";
import { flagOf } from "~/app/models/bookmarks";
/**
 * Mails the bookmarks flagged since the last digest. It runs daily and sends nothing when
 * nothing is new, so mail follows the weekly check, and a failed send is retried before
 * any flag is marked reported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { bookmarkLabel } from "~/app/models/post-values";
import routes from "~/routes/web";

/** The mailbox digests come from, on the domain verified for the email binding. */
export const DIGEST_SENDER: Address = {
	email: "bookmarks@support.sergiodxa.com",
	name: "Bookmarks",
};

/** Who reviews flagged bookmarks. */
export const DIGEST_RECIPIENT: Address = { email: "hello@sergiodxa.com" };

/** The site the CMS links in a digest point at, so they open from any mail client. */
const SITE = "https://sergiodxa.com";

/**
 * A worker without an email binding ends the run as a failure, leaving every flag
 * unreported so the next run mails it once the binding exists.
 */
export default createJobHandler(jobs.bookmarks.digest, async (ctx) => {
	let records = await ctx.models.bookmarks.findUnreported();
	if (records.length === 0) return ctx.ack("No new flags");

	if (!ctx.mail) return ctx.exit("The worker has no email binding");

	let items: BookmarksDigestEmail.Item[] = [];
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

	let mailer = new Mailer({ transport: ctx.mail, from: DIGEST_SENDER });
	let sent = await mailer.send(new BookmarksDigestEmail(DIGEST_RECIPIENT, items));
	if (isFailure(sent)) ctx.retry({ delay: "1 hour", cause: sent.error });

	await ctx.models.bookmarks.reported(
		records.map((record) => record.post_id),
		new Date().toISOString(),
	);
	ctx.log.set({ bookmarks: { reported: items.length } });
});

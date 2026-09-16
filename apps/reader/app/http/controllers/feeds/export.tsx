/**
 * OPML export controller for `GET /feeds.opml`. It answers with the reader's whole
 * subscription list as the document every other reader knows how to read, so leaving
 * takes one click and arriving somewhere else takes one upload.
 *
 * The document is written filed: one outline per folder holding the feeds in it, and the
 * unfiled subscriptions after them, so an export handed to another reader arrives
 * organized the way it left.
 *
 * The response is a file rather than a page: an OPML content type and an `attachment`
 * disposition naming it after the day it was taken, which keeps this month's export
 * beside last month's in a downloads folder instead of on top of it. It is one person's
 * subscription list assembled for that person alone, so it is stored nowhere along the
 * way. A reader who follows nothing gets the same document with no subscriptions in it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { OPML } from "@sdxc/opml";

import { stringify } from "@sdxc/opml";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The media type OPML travels under, which a reader offering an import looks for. */
const CONTENT_TYPE = "text/x-opml; charset=utf-8";

/**
 * The name the document lands under. It says which app it came from and which day it
 * describes, so a folder holding several of them stays readable.
 *
 * @param now - When the export was taken.
 */
function filename(now: Date): string {
	return `reader-subscriptions-${now.toISOString().slice(0, 10)}.opml`;
}

/** GET /feeds.opml — the subscription list as OPML. */
export default createAction(routes.feeds.export, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let feeds = await userStore(viewer.id).exportFeeds();

		let outlines = feeds.map<OPML.Outline>((feed) => ({
			title: feed.title,
			feedUrl: feed.feedUrl,
			siteUrl: feed.siteUrl ?? undefined,
			/** The document writes this as the outline around the feed, so filing travels. */
			folder: feed.folder ?? undefined,
		}));

		let now = new Date();

		let document = stringify(outlines, {
			title: ctx.i18next.t("feeds.transfer.documentTitle"),
			dateCreated: now,
		});

		return new Response(document, {
			headers: {
				"content-type": CONTENT_TYPE,
				"content-disposition": `attachment; filename="${filename(now)}"`,
				/** One reader's whole subscription list, kept out of every cache between here and them. */
				"cache-control": "private, no-store",
			},
		});
	},
});

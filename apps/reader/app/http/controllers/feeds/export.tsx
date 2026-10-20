/**
 * OPML export controller for `GET /feeds.opml`. It answers with the reader's whole
 * subscription list as the document every other reader knows how to read, so leaving
 * takes one click and arriving somewhere else takes one upload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import { exportFilename, subscriptionsOpml } from "~/app/services/data-export";
import routes from "~/routes/web";

/** The media type OPML travels under, which a reader offering an import looks for. */
const CONTENT_TYPE = "text/x-opml; charset=utf-8";

/** GET /feeds.opml — the subscription list as OPML. */
export default createAction(routes.feeds.export, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let feeds = await userStore(viewer.id).exportFeeds();
		let now = new Date();
		let document = subscriptionsOpml(feeds, ctx.intl.t("feeds.transfer.documentTitle"), now);

		return new Response(document, {
			headers: {
				"content-type": CONTENT_TYPE,
				"content-disposition": `attachment; filename="${exportFilename("subscriptions", "opml", now)}"`,
				/** One reader's whole subscription list, kept out of every cache between here and them. */
				"cache-control": "private, no-store",
			},
		});
	},
});

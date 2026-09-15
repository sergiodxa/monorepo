/**
 * Mark-feed-read controller for `POST /feeds/:feedId/read`. It takes one feed's unread
 * posts out of the queue, for a reader who has seen enough of that publisher for now, and
 * returns them to the feed's own page.
 *
 * It renders nothing. The outcome travels in the `marked` query parameter of the redirect,
 * so the feed page is the single place that says what happened, in its own copy. The
 * parameter carries a decimal count of the posts the store marked read, which is `0` when
 * the feed had nothing unread left — enough for the page to tell those two apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the feed page reads the number of posts marked read out of. */
export const MARKED_PARAM = "marked";

/** The path this route matches, which carries the subscription to clear. */
const Params = s.object({ feedId: s.string() });

/**
 * POST /feeds/:feedId/read — clears one feed's unread posts and reports back on its page.
 *
 * Clearing a feed rewrites every unread row it owns, so `POST` alone reaches it: a link a
 * prefetcher or a mail scanner follows is a `GET` and passes straight through to the page.
 */
export default createAction(routes.feeds.read, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let marked = await userStore(viewer.id).markFeedRead(feedId);

		/** The rail counts this feed's unread, and the reader is being returned to the page beside it. */
		await forgetRailFeeds(viewer.id);

		let query = new URLSearchParams({ [MARKED_PARAM]: String(marked) });

		return redirect(`${routes.feeds.show.href({ feedId })}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});

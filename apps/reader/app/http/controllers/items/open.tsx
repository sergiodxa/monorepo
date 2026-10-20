/**
 * Open-post controller for `POST /items/:itemId/open`. Every post's title carries a `ping`
 * attribute naming this URL, so the browser posts here itself as it follows the title
 * through to the publisher: opening a post is what takes it out of the queue, while the
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import routes from "~/routes/web";

/** The answer to a ping that marked a post read: taken, with nothing to say back. */
const MARKED_STATUS = 204;

/** The answer for a post this reader has nothing stored for. */
const NOT_FOUND_STATUS = 404;

/** The post the URL names, which is everything this route reads from the request. */
const ItemParams = s.object({ itemId: s.string() });

/**
 * POST /items/:itemId/open — marks one post read on the browser's report of a click. The
 * browser composes this request, not a form: it arrives with the body `PING` under
 * `text/ping`, which the global form-data middleware hands on as empty form data.
 */
export default createAction(routes.items.open, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { itemId } = s.parse(ItemParams, ctx.params);

		let marked = await userStore(viewer.id).markRead(itemId);

		/**
		 * The sidebar counts this post among its feed's unread, so it is dropped as the post
		 * leaves the queue rather than a moment later. Opening posts is how most of them are
		 * read, so a count that survived this would be the one a reader saw go wrong.
		 */
		await forgetRailFeeds(viewer.id);

		return new Response(null, { status: marked ? MARKED_STATUS : NOT_FOUND_STATUS });
	},
});

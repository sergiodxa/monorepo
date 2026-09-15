/**
 * Open-post controller for `POST /items/:itemId/open`. Every post's title carries a `ping`
 * attribute naming this URL, so the browser posts here itself as it follows the title
 * through to the publisher: opening a post is what takes it out of the queue, while the
 * title stays an ordinary link — copyable, middle-clickable, and showing the publisher's
 * own address in the status bar.
 *
 * Nobody ever sees this response. The browser sends the request while navigating away and
 * discards whatever comes back, so this answers with a status and no body.
 *
 * `POST /items/:itemId/read` stays beside it, and stays the reliable path: it is what a
 * reader submits to mark a post read without opening it, to put one back as unread, and
 * to catch the posts this misses in a browser that sends no pings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The answer to a ping that marked a post read: taken, with nothing to say back. */
const MARKED_STATUS = 204;

/** The answer for a post this reader has nothing stored for. */
const NOT_FOUND_STATUS = 404;

/** The post the URL names, which is everything this route reads from the request. */
const ItemParams = s.object({ itemId: s.string() });

/**
 * POST /items/:itemId/open — marks one post read on the browser's report of a click.
 *
 * The browser composes this request, not a form: it arrives with the body `PING` under
 * `text/ping`, which the global form-data middleware hands on as empty form data. So the
 * post being marked is taken from the URL alone, and the body is left where it is.
 */
export default createAction(routes.items.open, {
	middleware: [requireUser],
	async handler(ctx) {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { itemId } = s.parse(ItemParams, ctx.params);

		let marked = await userStore(viewer.id).markRead(itemId);

		return new Response(null, { status: marked ? MARKED_STATUS : NOT_FOUND_STATUS });
	},
});

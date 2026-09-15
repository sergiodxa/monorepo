/**
 * Mark-everything-read controller for `POST /reading/read`. It empties the queue in one
 * go, for a reader who has fallen far enough behind that starting fresh beats working
 * through the backlog, and returns them to the queue.
 *
 * It renders nothing. The outcome travels in the `marked` query parameter of the redirect,
 * so the queue is the single place that says what happened, in its own copy. The parameter
 * carries a decimal count of the posts the store marked read, which is `0` when the queue
 * was already empty — enough for the queue to tell those two apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { queueUrl, queueViewOf, SHOW_PARAM } from "~/app/http/controllers/queue-view";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import { SEARCH_PARAM } from "~/resources/layouts/app";
import routes from "~/routes/web";

/** The query parameter the queue reads the number of posts marked read out of. */
export const MARKED_PARAM = "marked";

/**
 * The narrowing the queue this was pressed from is reading under, which a form carries in
 * its own fields. Either one absent reads as no narrowing, which is the whole queue.
 */
const SweepForm = f.object({
	[SEARCH_PARAM]: f.field(s.defaulted(s.string(), "")),
	[SHOW_PARAM]: f.field(s.defaulted(s.string(), "")),
});

/**
 * POST /reading/read — empties the reading queue and reports back on the queue itself.
 *
 * This is the one action that reaches every post a reader has, so `POST` alone reaches it:
 * a link a prefetcher or a mail scanner follows is a `GET` and leaves the queue as it is.
 */
export default createAction(routes.readAll, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parseSafe(SweepForm, ctx.formData);

		let view = queueViewOf(
			submitted.success ? submitted.value[SEARCH_PARAM] : "",
			submitted.success ? submitted.value[SHOW_PARAM] : "",
		);

		let marked = await userStore(viewer.id).markAllRead();

		/** Every count the sidebar draws has just gone to nothing. */
		await forgetRailFeeds(viewer.id);

		return redirect(queueUrl(view, null, { [MARKED_PARAM]: String(marked) }), {
			status: redirect.Status.SeeOther,
		});
	},
});

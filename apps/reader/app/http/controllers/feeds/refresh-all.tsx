/**
 * Check-every-feed controller for `POST /feeds/refresh`. It sweeps every subscription on
 * the spot, for a reader who wants everything current before they sit down with it, and
 * returns them to the reading queue they pressed it from, narrowed as they left it.
 *
 * It renders nothing. The outcome travels in three query parameters of the redirect, so
 * the queue is the single place that says what happened, in its own copy. Each one
 * carries a decimal count, and all three are always present:
 *
 * - `swept` — feeds the sweep reached.
 * - `fresh` — how many of those answered with posts the reader had not seen.
 * - `failed` — how many refused, timed out, or sent something that is not a feed.
 *
 * The posts the sweep brought in stay behind: the sentence speaks in feeds, and a post
 * count belongs to the feed that published it, which the feed's own page already reports.
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

/** The query parameter the queue reads the number of swept feeds out of. */
export const SWEPT_PARAM = "swept";

/** The query parameter the queue reads the number of feeds with new posts out of. */
export const FRESH_PARAM = "fresh";

/** The query parameter the queue reads the number of unreachable feeds out of. */
export const FAILED_PARAM = "failed";

/**
 * The narrowing the queue this was pressed from is reading under, which a form carries in
 * its own fields. Either one absent reads as no narrowing, which is the whole queue.
 */
const SweepForm = f.object({
	[SEARCH_PARAM]: f.field(s.defaulted(s.string(), "")),
	[SHOW_PARAM]: f.field(s.defaulted(s.string(), "")),
});

/**
 * POST /feeds/refresh — checks every followed feed now and reports back on the queue.
 *
 * A sweep retrieves every origin the reader follows, so `POST` alone reaches it: a link a
 * prefetcher or a mail scanner follows is a `GET` and passes straight through to the queue.
 */
export default createAction(routes.feeds.refreshAll, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parseSafe(SweepForm, ctx.formData);

		let view = queueViewOf(
			submitted.success ? submitted.value[SEARCH_PARAM] : "",
			submitted.success ? submitted.value[SHOW_PARAM] : "",
		);

		let result = await userStore(viewer.id).checkAllFeedsNow();

		/** The posts this brought in are the ones the sidebar counts, and the reader pressed for them. */
		await forgetRailFeeds(viewer.id);

		return redirect(
			queueUrl(view, null, {
				[SWEPT_PARAM]: String(result.checked),
				[FRESH_PARAM]: String(result.withNewPosts),
				[FAILED_PARAM]: String(result.failed),
			}),
			{ status: redirect.Status.SeeOther },
		);
	},
});

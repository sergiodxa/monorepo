/**
 * Check-every-feed controller for `POST /feeds/refresh`. It sweeps every subscription on
 * the spot, for a reader who wants the whole list current before they sit down with it,
 * and returns them to the feed list.
 *
 * It renders nothing. The outcome travels in three query parameters of the redirect, so
 * the feed list is the single place that says what happened, in its own copy. Each one
 * carries a decimal count, and all three are always present:
 *
 * - `swept` — feeds the sweep reached.
 * - `fresh` — how many of those answered with posts the reader had not seen.
 * - `failed` — how many refused, timed out, or sent something that is not a feed.
 *
 * The posts the sweep brought in stay behind: the list speaks in feeds, and a post count
 * belongs to the feed that published it, which the feed's own page already reports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the feed list reads the number of swept feeds out of. */
export const SWEPT_PARAM = "swept";

/** The query parameter the feed list reads the number of feeds with new posts out of. */
export const FRESH_PARAM = "fresh";

/** The query parameter the feed list reads the number of unreachable feeds out of. */
export const FAILED_PARAM = "failed";

/**
 * POST /feeds/refresh — checks every followed feed now and reports back on the feed list.
 *
 * A sweep retrieves every origin the reader follows, so `POST` alone reaches it: a link a
 * prefetcher or a mail scanner follows is a `GET` and passes straight through to the list.
 */
export default createAction(routes.feeds.refreshAll, {
	middleware: [requireUser],
	handler: async () => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let result = await userStore(viewer.id).checkAllFeedsNow();

		let query = new URLSearchParams({
			[SWEPT_PARAM]: String(result.checked),
			[FRESH_PARAM]: String(result.withNewPosts),
			[FAILED_PARAM]: String(result.failed),
		});

		return redirect(`${routes.feeds.index.href()}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});

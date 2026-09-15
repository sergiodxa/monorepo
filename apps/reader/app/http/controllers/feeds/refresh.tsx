/**
 * Check-now controller for `POST /feeds/:feedId/refresh`. It retrieves one feed on the
 * spot, for a reader who knows a site has just published and would rather not wait out
 * their refresh cadence, and returns them to the feed's own page.
 *
 * It renders nothing. The outcome travels in the `checked` query parameter of the
 * redirect, so the feed page is the single place that says what happened, in its own copy.
 * The parameter carries exactly one of four values:
 *
 * - `new` — the check brought in posts the reader had not seen.
 * - `none` — the origin answered and there was nothing new.
 * - `failed` — the origin refused, timed out, or sent something that is not a feed.
 * - `missing` — the reader does not follow that feed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { UserStore } from "~/database/user-do";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the feed page reads the outcome of a check out of. */
export const CHECKED_PARAM = "checked";

/** The path this route matches, which carries the subscription to check. */
const Params = s.object({ feedId: s.string() });

/** What one value of {@link CHECKED_PARAM} can be. */
type Checked = "new" | "none" | "failed" | "missing";

/**
 * The value the redirect carries for one outcome. Only posts the reader had not seen
 * count as `new`: a publisher fixing a typo revises a post they may well have read
 * already, which is news about that post rather than something to come back for.
 *
 * @param result - What the reader's store answered the check with.
 */
function checked(result: UserStore.CheckResult): Checked {
	if (!result.ok) return result.reason === "not-following" ? "missing" : "failed";
	return result.inserted > 0 ? "new" : "none";
}

/** POST /feeds/:feedId/refresh — checks one feed now and reports back on the feed's page. */
export default createAction(routes.feeds.refresh, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let result = await userStore(viewer.id).checkFeedNow(feedId);

		let query = new URLSearchParams({ [CHECKED_PARAM]: checked(result) });

		return redirect(`${routes.feeds.show.href({ feedId })}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});

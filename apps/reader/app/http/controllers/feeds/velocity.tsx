/**
 * Velocity controller for `POST /feeds/:feedId/velocity`. It sets how long a feed's posts
 * stay in this reader's timeline and returns them to the feed's own page.
 *
 * It renders nothing. The outcome travels in the `velocity` query parameter of the
 * redirect, so the feed page is the single place that says what happened, in its own copy.
 * The parameter carries exactly one of three values:
 *
 * - `saved` — the span is now what the reader chose.
 * - `invalid` — the submission named a span this app does not offer.
 * - `missing` — the reader does not follow that feed.
 *
 * The choice may drop posts the reader has not read, which nothing else in this app does.
 * That is the point of it and why it is only ever a reader's own submission: a measured
 * publishing rate is offered beside this control as a sentence and never posted here on
 * anybody's behalf.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the feed page reads the outcome of a submission out of. */
export const VELOCITY_PARAM = "velocity";

/** The field the feed page's own control submits the chosen span under. */
export const VELOCITY_FIELD = "velocity";

/** The path this route matches, which carries the subscription being set. */
const Params = s.object({ feedId: s.string() });

/**
 * The span the form submits, as the text a field carries. The names are checked by the
 * store against the column's own `CHECK`, so a submission is passed along as it arrived
 * and a field missing altogether reads as the empty string the store refuses.
 */
const VelocityForm = f.object({ [VELOCITY_FIELD]: f.field(s.defaulted(s.string(), "")) });

/** POST /feeds/:feedId/velocity — sets how long that feed's posts stay. */
export default createAction(routes.feeds.velocity, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let submitted = s.parse(VelocityForm, ctx.formData);

		let result = await userStore(viewer.id).setVelocity(feedId, submitted[VELOCITY_FIELD]);

		/** A shorter span takes posts out of the feed, which is a count the rail draws. */
		if (result.ok) await forgetRailFeeds(viewer.id);

		let outcome = result.ok ? "saved" : result.reason === "not-following" ? "missing" : "invalid";
		let query = new URLSearchParams({ [VELOCITY_PARAM]: outcome });

		return redirect(`${routes.feed.href({ feed: feedId })}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});

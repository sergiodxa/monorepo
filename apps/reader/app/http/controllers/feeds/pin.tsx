/**
 * Pin controller for `POST /feeds/:feedId/pin`. It pins a subscription to the strip above
 * the queue, or takes the pin off, and returns the reader to the feed's own page. It
 * renders nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { iife } from "@sdxc/iife";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import routes from "~/routes/web";

/** The query parameter the feed page reads the outcome of a submission out of. */
export const PIN_PARAM = "pin";

/** The field the feed page's own control submits which way it is moving under. */
export const PIN_FIELD = "pinned";

/** The path this route matches, which carries the subscription being pinned. */
const Params = s.object({ feedId: s.string() });

/** Which way the control is moving; a submission missing the field pins. */
const PinForm = f.object({
	[PIN_FIELD]: f.field(s.defaulted(s.string(), "true").transform((value) => value === "true")),
});

/** POST /feeds/:feedId/pin — pins one feed above the queue, or takes the pin off. */
export default createAction(routes.feeds.pin, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let submitted = s.parse(PinForm, ctx.formData);

		let result = await userStore(viewer.id).pinFeed(feedId, submitted[PIN_FIELD]);

		/** The rail draws a pinned feed apart from the rest, so where this one is drawn moved. */
		if (result.ok) await forgetRailFeeds(viewer.id);

		let outcome = iife(() => {
			if (result.ok) return result.pinned ? "pinned" : "unpinned";
			if (result.reason === "pin-limit") return "full";
			return "missing";
		});

		let query = new URLSearchParams({ [PIN_PARAM]: outcome });

		return redirect(`${routes.feed.href({ feed: feedId })}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});

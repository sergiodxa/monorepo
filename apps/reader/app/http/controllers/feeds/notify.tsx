/**
 * Notify controller for `POST /feeds/:feedId/notify`. It opts one subscription in to
 * notifications, or out of them, and returns the reader to the feed's own page.
 *
 * It renders nothing. The outcome travels in the `notify` query parameter of the redirect,
 * so the feed page is the single place that says what happened, in its own copy. The
 * answer is about a publisher rather than about a device, so it is shared by every browser
 * the reader is reached on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the feed page reads the outcome of a submission out of. */
export const NOTIFY_PARAM = "notify";

/** The field the feed page's own control submits which way it is moving under. */
export const NOTIFY_FIELD = "notify";

/** The path this route matches, which carries the subscription being opted in. */
const Params = s.object({ feedId: s.string() });

/** Which way the control is moving; a submission missing the field opts in. */
const NotifyForm = f.object({
	[NOTIFY_FIELD]: f.field(s.defaulted(s.string(), "true").transform((value) => value === "true")),
});

/** POST /feeds/:feedId/notify — opts one subscription in to notifications, or out. */
export default createAction(routes.feeds.notify, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { feedId } = s.parse(Params, ctx.params);
		let submitted = s.parse(NotifyForm, ctx.formData);

		let result = await userStore(viewer.id).setFeedNotify(feedId, submitted[NOTIFY_FIELD]);

		let outcome = result.ok ? (result.notify ? "on" : "off") : "missing";
		let query = new URLSearchParams({ [NOTIFY_PARAM]: outcome });

		return redirect(`${routes.feed.href({ feed: feedId })}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});

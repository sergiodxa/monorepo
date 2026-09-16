/**
 * Time-zone capture for `POST /settings/notifications/time-zone`. The browser is the only
 * participant that knows where the reader is, so it reports its resolved IANA name and this
 * records it; quiet hours without a zone are quiet hours in UTC.
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

/** What the script posts, which is one resolved IANA name and nothing else. */
const TimeZone = s.object({ timeZone: s.string() });

/** POST /settings/notifications/time-zone — records the zone quiet hours are computed in. */
export default createAction(routes.notifications.timeZone, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(TimeZone, await ctx.request.json());
		let stored = await userStore(viewer.id).setTimeZone(submitted.timeZone);

		return Response.json({ stored });
	},
});

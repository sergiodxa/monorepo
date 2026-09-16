/**
 * Device registration for `POST /settings/notifications/devices`. A browser that has just
 * subscribed to a push service hands over the endpoint and key material it was given, and
 * this records it against the reader.
 *
 * It answers JSON rather than a page: nothing links here, and the only caller is the
 * script that subscribed.
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

/**
 * What a browser's `PushSubscription` reduces to. The endpoint is a URL rather than any
 * string, because it is what a delivery is addressed to and what uniqueness is taken over.
 */
const Registration = s.object({
	endpoint: s.string(),
	p256dh: s.string(),
	auth: s.string(),
	locale: s.optional(s.string()),
});

/** POST /settings/notifications/devices — records a browser the reader asked to be reached on. */
export default createAction(routes.notifications.devices, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(Registration, await ctx.request.json());

		let registered = await userStore(viewer.id).registerDevice({
			endpoint: submitted.endpoint,
			p256dh: submitted.p256dh,
			auth: submitted.auth,
			userAgent: ctx.request.headers.get("user-agent"),
			locale: submitted.locale ?? ctx.locale,
		});

		return Response.json(registered);
	},
});

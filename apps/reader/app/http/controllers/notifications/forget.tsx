/**
 * Device revocation for `DELETE /settings/notifications/devices/:deviceId`. It forgets one
 * browser and returns the reader to the settings page, which draws the list without it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the settings page reads the outcome of a revocation out of. */
export const FORGET_PARAM = "device";

/** The path this route matches, which carries the device being revoked. */
const Params = s.object({ deviceId: s.string() });

/** DELETE /settings/notifications/devices/:deviceId — forgets one browser. */
export default createAction(routes.notifications.forget, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { deviceId } = s.parse(Params, ctx.params);
		let forgotten = await userStore(viewer.id).forgetDevice(deviceId);

		let query = new URLSearchParams({ [FORGET_PARAM]: forgotten ? "forgotten" : "missing" });

		return redirect(`${routes.settings.href()}?${query}`, { status: redirect.Status.SeeOther });
	},
});

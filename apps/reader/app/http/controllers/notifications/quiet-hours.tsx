/**
 * Quiet-hours controller for `POST /settings/notifications/quiet-hours`. It sets the window
 * the reader is left alone in, in their own local hours, and returns them to the settings
 * page.
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
import { QUIET_FROM_HOUR, QUIET_TO_HOUR } from "~/database/schema";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the settings page reads the outcome of a submission out of. */
export const QUIET_PARAM = "quiet";

/** The field saying whether the window applies at all. */
export const QUIET_ENABLED_FIELD = "quietHours";

/** The field carrying the local hour the window opens at. */
export const QUIET_FROM_FIELD = "quietFrom";

/** The field carrying the local hour it closes at. */
export const QUIET_TO_FIELD = "quietTo";

/** An hour off a select, which reads as the default for anything that is not one. */
function hour(fallback: number) {
	return f.field(
		s.defaulted(s.string(), String(fallback)).transform((value) => {
			let parsed = Number.parseInt(value, 10);
			return Number.isNaN(parsed) ? fallback : parsed;
		}),
	);
}

/** The three fields the form submits, with an unchecked box reading as off. */
const QuietForm = f.object({
	[QUIET_ENABLED_FIELD]: f.field(s.defaulted(s.string(), "").transform((value) => value === "on")),
	[QUIET_FROM_FIELD]: hour(QUIET_FROM_HOUR),
	[QUIET_TO_FIELD]: hour(QUIET_TO_HOUR),
});

/** POST /settings/notifications/quiet-hours — sets the window the reader is left alone in. */
export default createAction(routes.notifications.quietHours, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(QuietForm, ctx.formData);

		await userStore(viewer.id).setQuietHours({
			enabled: submitted[QUIET_ENABLED_FIELD],
			from: submitted[QUIET_FROM_FIELD],
			to: submitted[QUIET_TO_FIELD],
		});

		let query = new URLSearchParams({ [QUIET_PARAM]: "saved" });

		return redirect(`${routes.settings.href()}?${query}`, { status: redirect.Status.SeeOther });
	},
});

/**
 * Channels controller for `POST /settings/notifications`. It decides how a notified feed
 * reaches the reader and returns them to the settings page, which says what happened in
 * its own copy.
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

/** The query parameter the settings page reads the outcome of a submission out of. */
export const CHANNELS_PARAM = "channels";

/** The field each switch submits, absent from the body when the reader turned it off. */
export const PUSH_FIELD = "push";

/** The field the email switch submits, beside {@link PUSH_FIELD}. */
export const EMAIL_FIELD = "email";

/** A checkbox absent from the body reads as off, which is how an unchecked box submits. */
const ChannelsForm = f.object({
	[PUSH_FIELD]: f.field(s.defaulted(s.string(), "").transform((value) => value === "on")),
	[EMAIL_FIELD]: f.field(s.defaulted(s.string(), "").transform((value) => value === "on")),
});

/** POST /settings/notifications — turns the push and email channels on or off. */
export default createAction(routes.notifications.channels, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(ChannelsForm, ctx.formData);

		let result = await userStore(viewer.id).setChannels({
			push: submitted[PUSH_FIELD],
			email: submitted[EMAIL_FIELD],
		});

		let query = new URLSearchParams({
			[CHANNELS_PARAM]: result.ok ? "saved" : "not-entitled",
		});

		return redirect(`${routes.settings.href()}?${query}`, { status: redirect.Status.SeeOther });
	},
});

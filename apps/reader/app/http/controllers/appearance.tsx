/**
 * Appearance controller for `POST /settings/appearance`: the scheme the reader's pages are
 * painted in and the face their reading surfaces are set in.
 *
 * One fact with two writers, on one response. The reader's own object is the record, so a
 * choice made on one machine is there on the next; the cookie is what the document shell
 * reads, so the answer is an input to the first paint rather than a correction applied
 * after it. Storing and setting happen here together, which is what keeps the window
 * between them to nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { writePresentation } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The query parameter the settings page reads the outcome of a submission out of. */
export const APPEARANCE_PARAM = "appearance";

/** The field the scheme is submitted under. */
export const THEME_FIELD = "theme";

/** The field the reading face is submitted under, beside {@link THEME_FIELD}. */
export const FACE_FIELD = "face";

/**
 * Two fields of text, taken as they arrive. Narrowing them to their sets is the object's,
 * which is what makes a submission nothing on the page could have produced store the
 * default rather than depend on which of the two guards ran.
 */
const AppearanceForm = f.object({
	[THEME_FIELD]: f.field(s.defaulted(s.string(), "")),
	[FACE_FIELD]: f.field(s.defaulted(s.string(), "")),
});

/** POST /settings/appearance — stores the scheme and the reading face, and sets the cookie. */
export default createAction(routes.appearance, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(AppearanceForm, ctx.formData);

		let stored = await userStore(viewer.id).setPresentation({
			theme: submitted[THEME_FIELD],
			face: submitted[FACE_FIELD],
		});

		let query = new URLSearchParams({ [APPEARANCE_PARAM]: "saved" });

		/**
		 * What was stored rather than what was submitted, so the cookie carries whatever the
		 * object decided the answer is and the two cannot leave here disagreeing.
		 */
		return redirect(`${routes.settings.href()}?${query}`, {
			status: redirect.Status.SeeOther,
			headers: { "Set-Cookie": await writePresentation(stored) },
		});
	},
});

/**
 * Label creation for `POST /tags`. It makes a label to put on the posts a reader keeps and
 * sends them to the list that label reads as. It renders nothing.
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
import { userStore } from "~/app/models/user-store";
import routes from "~/routes/web";

/** The query parameter a label's page reads the outcome of a label action out of. */
export const TAG_PARAM = "tag";

/** The field a label's name is submitted under, wherever one is named. */
export const NAME_FIELD = "name";

/** The name the form submits, which the store folds and holds to its unique index. */
const NameForm = f.object({ [NAME_FIELD]: f.field(s.defaulted(s.string(), "")) });

/**
 * Where a label's own page is, carrying what just happened to it.
 *
 * @param tagId - The label to stand in.
 * @param outcome - What to tell the reader once they are there.
 */
export function tagPage(tagId: string, outcome: string): string {
	let query = new URLSearchParams({ [TAG_PARAM]: outcome });
	return `${routes.tag.href({ tag: tagId })}?${query}`;
}

/** POST /tags — makes a label to put on kept posts. */
export default createAction(routes.tags.create, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let submitted = s.parse(NameForm, ctx.formData);
		let created = await userStore(viewer.id).createTag(submitted[NAME_FIELD]);

		if (created.ok) {
			return redirect(tagPage(created.tag.id, "created"), {
				status: redirect.Status.SeeOther,
			});
		}

		/**
		 * Somebody who asked for a label by a name they already use asked for the label they
		 * have, so they are taken to it rather than told they cannot have it twice.
		 */
		if (created.reason === "tag-exists") {
			return redirect(tagPage(created.tag.id, "duplicate"), {
				status: redirect.Status.SeeOther,
			});
		}

		/**
		 * Nothing was made, and the sentence saying why belongs on a page that exists: the
		 * saved list is where labels are put on things, so it is where the reader is left.
		 */
		let query = new URLSearchParams({ [TAG_PARAM]: created.reason });

		return redirect(`${routes.saved.href()}?${query}`, { status: redirect.Status.SeeOther });
	},
});

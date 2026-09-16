/**
 * Label renaming for `POST /tags/:tagId`. It changes the name a set of kept posts reads
 * under and returns the reader to that label's own page.
 *
 * Renaming writes one row and rewrites no post, however many carry the label: everything
 * else holds it by its id, which a name never was.
 *
 * It renders nothing. The outcome travels in the `tag` query parameter of the redirect, so
 * the label's page is the single place that says what happened, in its own copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { NAME_FIELD, tagPage } from "~/app/http/controllers/tags/create";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The path this route matches, which carries the label being renamed. */
const Params = s.object({ tagId: s.string() });

/** The name the form submits, which the store folds and holds to its unique index. */
const NameForm = f.object({ [NAME_FIELD]: f.field(s.defaulted(s.string(), "")) });

/** POST /tags/:tagId — renames one label. */
export default createAction(routes.tags.rename, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { tagId } = s.parse(Params, ctx.params);
		let submitted = s.parse(NameForm, ctx.formData);

		let renamed = await userStore(viewer.id).renameTag(tagId, submitted[NAME_FIELD]);

		/**
		 * A colliding name is refused rather than merged, so the page names the label already
		 * reading under it and the reader decides what they meant.
		 */
		let outcome = renamed.ok ? "renamed" : renamed.reason;

		return redirect(tagPage(tagId, outcome), { status: redirect.Status.SeeOther });
	},
});

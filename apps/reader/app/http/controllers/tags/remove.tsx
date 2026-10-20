/**
 * Unlabelling for `DELETE /items/:itemId/tags/:tagId`. It takes one label off one post and
 * returns the reader to the list they acted from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import * as f from "remix/data-schema/form-data";
import { createAction } from "remix/router";

import { localPath } from "~/app/http/controllers/items/save";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import routes from "~/routes/web";

/** The path this route matches, which carries the post and the label coming off it. */
const Params = s.object({ itemId: s.string(), tagId: s.string() });

/** Where the reader was, so working down a list stays a run of submissions against it. */
const RemoveForm = f.object({ returnTo: f.field(s.defaulted(s.string(), "")) });

/** DELETE /items/:itemId/tags/:tagId — takes one label off one post. */
export default createAction(routes.tags.remove, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { itemId, tagId } = s.parse(Params, ctx.params);
		let submitted = s.parse(RemoveForm, ctx.formData);

		await userStore(viewer.id).untagItem(itemId, tagId);

		return redirect(localPath(submitted.returnTo), { status: redirect.Status.SeeOther });
	},
});

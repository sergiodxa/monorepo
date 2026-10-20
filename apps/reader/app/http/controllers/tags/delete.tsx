/**
 * Label deletion for `DELETE /tags/:tagId`. It takes the label away and returns the reader
 * to the posts they have kept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/app/models/user-store";
import routes from "~/routes/web";

/** The path this route matches, which carries the label being deleted. */
const Params = s.object({ tagId: s.string() });

/** DELETE /tags/:tagId — takes the label away and leaves every post it was on. */
export default createAction(routes.tags.delete, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { tagId } = s.parse(Params, ctx.params);

		await userStore(viewer.id).deleteTag(tagId);

		return redirect(routes.saved.href(), { status: redirect.Status.SeeOther });
	},
});

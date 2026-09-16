/**
 * Folder deletion for `DELETE /folders/:folderId`. It takes the folder away and returns
 * the reader to their queue.
 *
 * A folder holds no posts, so deleting one deletes none: its feeds come back unfiled,
 * exactly as they were before anybody made it, and their posts come with them. That is
 * what the prompt on the folder's page says before this runs, which is why nothing travels
 * back to be said afterwards — there is no folder left to say it on, and nothing happened
 * that a reader has to be told about after the fact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { forgetRailFeeds } from "~/app/http/controllers/chrome";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The path this route matches, which carries the folder being deleted. */
const Params = s.object({ folderId: s.string() });

/** DELETE /folders/:folderId — takes the folder away and leaves its feeds unfiled. */
export default createAction(routes.folders.delete, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { folderId } = s.parse(Params, ctx.params);

		let removed = await userStore(viewer.id).deleteFolder(folderId);

		/** The rail drew the folder and now draws its feeds among the unfiled ones. */
		if (removed.ok) await forgetRailFeeds(viewer.id);

		return redirect(routes.reading.index.href(), { status: redirect.Status.SeeOther });
	},
});

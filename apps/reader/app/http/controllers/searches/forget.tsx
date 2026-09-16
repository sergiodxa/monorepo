/**
 * Saved-search deletion for `DELETE /searches/:searchId`. It forgets a kept query, which
 * deletes no post and empties no list: the row held a narrowing, so what goes is the rail's
 * own row and the address behind it.
 *
 * It renders nothing. The reader is returned to the plain queue with the outcome in its
 * query, since the address they were standing on may be the search that has just gone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { forgetRailSearches } from "~/app/http/controllers/chrome";
import { SAVED_PARAM } from "~/app/http/controllers/searches/save";
import { getViewer } from "~/app/http/middleware/auth";
import requireUser from "~/app/http/middleware/require-user";
import { userStore } from "~/database/user-do";
import routes from "~/routes/web";

/** The one path segment this route carries, which is the saved search being forgotten. */
const Params = s.object({ searchId: s.string() });

/** DELETE /searches/:searchId — forgets a kept query. */
export default createAction(routes.searches.delete, {
	middleware: [requireUser],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { searchId } = s.parse(Params, ctx.params);
		let forgotten = await userStore(viewer.id).deleteSearch(searchId);

		/** The rail no longer lists it, so the band drawn beside the next page does not either. */
		if (forgotten.ok) await forgetRailSearches(viewer.id);

		let query = new URLSearchParams({
			[SAVED_PARAM]: forgotten.ok ? "forgotten" : forgotten.reason,
		});

		return redirect(`${routes.reading.index.href()}?${query}`, {
			status: redirect.Status.SeeOther,
		});
	},
});

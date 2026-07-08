/**
 * `/app` entry redirect. Sends a signed-in viewer to their first team's URL. Requires
 * `requireUser`, so a viewer is always present here; requiring at least one team is a
 * safe assumption because sign-in always provisions or joins one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { inject } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Team from "~/app/data/team";
import { getViewer } from "~/app/http/middleware/auth";
import routes from "~/routes/web";

/** GET /app — redirects to the viewer's team. */
export default createAction(
	routes.app.index,
	inject([Database] as const, async (db) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let teams = await Team.listBySubjectId(db, viewer.id);
		let firstTeam = teams[0];
		if (!firstTeam) throw new Error(`Viewer ${viewer.id} has no team membership`);

		return redirect(routes.app.team.index.href({ team: firstTeam.slug }), {
			status: redirect.Status.SeeOther,
		});
	}),
);

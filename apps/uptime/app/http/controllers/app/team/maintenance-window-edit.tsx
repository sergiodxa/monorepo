/**
 * Edit maintenance window page controller. Requires `requireUser` + `requireTeam`; 404s when
 * the window doesn't belong to the current team. The update action draws the same page again
 * with the posted values when it refuses a submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { listScopeMonitors } from "~/app/services/scope-monitors";
import EditMaintenanceWindowPage from "~/resources/views/maintenance-windows/edit-page";
import routes from "~/routes/web";

/** GET /app/:team/maintenance/:windowId/edit — a maintenance window's edit form. */
export default createAction(routes.app.team.maintenanceWindows.edit, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let { windowId } = s.parse(s.object({ windowId: s.string() }), ctx.params);
		let window = await ctx.models.maintenanceWindows.inTeam(ctx.team.id).find(windowId);
		if (!window) return notFound("Not Found");

		let scopeGroups = await listScopeMonitors(ctx.models, ctx.team.id);
		return ctx.render(<EditMaintenanceWindowPage window={window} scopeGroups={scopeGroups} />);
	},
});

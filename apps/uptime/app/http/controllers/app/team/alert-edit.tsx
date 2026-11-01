/**
 * Edit alert page controller. Requires `requireUser` + `requireTeam`; 404s when the alert
 * doesn't belong to the current team. The update action draws the same page again with the
 * posted values when it refuses a submission.
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
import EditAlertPage from "~/resources/views/alerts/edit-page";
import routes from "~/routes/web";

/** GET /app/:team/alerts/:alertId/edit — an alert's edit form. */
export default createAction(routes.app.team.alerts.edit, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let { alertId } = s.parse(s.object({ alertId: s.string() }), ctx.params);
		let alert = await ctx.models.alerts.inTeam(ctx.team.id).find(alertId);
		if (!alert) return notFound("Not Found");

		let scopeGroups = await listScopeMonitors(ctx.models, ctx.team.id);
		return ctx.render(<EditAlertPage alert={alert} scopeGroups={scopeGroups} />);
	},
});

/**
 * New alert page controller. Requires `requireUser` + `requireTeam`; the create action draws
 * the same page again with the posted values when it refuses a submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { listScopeMonitors } from "~/app/services/scope-monitors";
import NewAlertPage from "~/resources/views/alerts/new-page";
import routes from "~/routes/web";

/** GET /app/:team/alerts/new — the new alert form, empty on a first visit. */
export default createAction(routes.app.team.alerts.new, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let scopeGroups = await listScopeMonitors(ctx.models, ctx.team.id);
		return ctx.render(<NewAlertPage scopeGroups={scopeGroups} />);
	},
});

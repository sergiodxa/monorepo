/**
 * New flow monitor form page controller. Requires `requireUser` + `requireTeam`, and reads the
 * team's verified domains so the form states what a spec may reach; the create action draws the
 * same page again with what was typed when it refuses a submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import NewFlowMonitorPage from "~/resources/views/flow-monitors/new-page";
import routes from "~/routes/web";

/** GET /app/:team/flows/new — the new flow monitor form, empty on a first visit. */
export default createAction(routes.app.team.flowMonitors.new, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);
		return ctx.render(<NewFlowMonitorPage verifiedDomains={verifiedDomains} />);
	},
});

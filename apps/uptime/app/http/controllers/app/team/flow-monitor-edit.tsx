/**
 * Edit flow monitor page controller. Requires `requireUser` + `requireTeam`; 404s on another
 * team's monitor. The update action draws the same page again with what was typed when it
 * refuses a submission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import EditFlowMonitorPage from "~/resources/views/flow-monitors/edit-page";
import routes from "~/routes/web";

/**
 * GET /app/:team/flows/:monitorId/edit — a flow monitor's edit form. The danger zone renders
 * only for a member allowed to delete flow monitors.
 */
export default createAction(routes.app.team.flowMonitors.edit, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.flowMonitors
			.inTeam(ctx.team.id)
			.where({ id: monitorId })
			.first();
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.flowMonitors.delete);
		let verifiedDomains = await ctx.models.teamDomains.verifiedHostnames(ctx.team.id);
		return ctx.render(
			<EditFlowMonitorPage
				monitor={monitor}
				canDelete={ctx.access.can(abilities.flowMonitors.delete)}
				verifiedDomains={verifiedDomains}
			/>,
		);
	},
});

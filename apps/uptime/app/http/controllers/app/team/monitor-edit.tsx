/**
 * Edit HTTP monitor page controller: general settings, content checks, and SSL monitoring
 * settings; 404s when the monitor doesn't belong to the current team. The update action draws
 * the same page again with a failed submission's values and per-field issues.
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
import EditMonitorPage from "~/resources/views/monitors/edit-page";
import routes from "~/routes/web";

/**
 * GET /app/:team/monitors/:monitorId/edit — a monitor's edit form. The danger zone renders
 * only for a member allowed to delete monitors.
 */
export default createAction(routes.app.team.monitors.edit, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.monitors.inTeam(ctx.team.id).find(monitorId);
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.monitors.delete);
		let contentChecks = await ctx.models.contentChecks.ofMonitor(monitor.id).all();
		return ctx.render(
			<EditMonitorPage
				monitor={monitor}
				canDelete={ctx.access.can(abilities.monitors.delete)}
				contentChecks={contentChecks}
			/>,
		);
	},
});

/**
 * Edit TCP monitor page controller: settings form, posting to `update-tcp-monitor`.
 * Requires `requireUser` + `requireTeam`; 404s when the monitor doesn't belong to
 * the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { teamAccess } from "~/app/http/middleware/access";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import EditTcpMonitorPage from "~/resources/views/tcp-monitors/edit-page";
import routes from "~/routes/web";

/**
 * GET /app/:team/tcp/:monitorId/edit — a TCP monitor's edit form. The danger zone renders
 * only for a member allowed to delete monitors.
 */
export default createAction(routes.app.team.tcpMonitors.edit, {
	middleware: [requireUser, requireTeam, teamAccess],
	handler: async (ctx) => {
		await ctx.access.load(abilities.tcpMonitors.delete);
		let canDelete = ctx.access.can(abilities.tcpMonitors.delete);

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.tcpMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		return ctx.render(<EditTcpMonitorPage monitor={monitor} canDelete={canDelete} />);
	},
});

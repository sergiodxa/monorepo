/**
 * Edit DNS monitor page controller: settings form posting to `update-dns-monitor`.
 * Requires `requireUser` + `requireTeam` and 404s when the monitor doesn't belong
 * to the current team.
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
import EditDnsMonitorPage from "~/resources/views/dns-monitors/edit-page";
import routes from "~/routes/web";

/**
 * GET /app/:team/dns/:monitorId/edit — a DNS monitor's edit form. The danger zone renders
 * only for a member allowed to delete monitors.
 */
export default createAction(routes.app.team.dnsMonitors.edit, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		await ctx.access.load(abilities.dnsMonitors.delete);
		let canDelete = ctx.access.can(abilities.dnsMonitors.delete);

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		return ctx.render(<EditDnsMonitorPage monitor={monitor} canDelete={canDelete} />);
	},
});

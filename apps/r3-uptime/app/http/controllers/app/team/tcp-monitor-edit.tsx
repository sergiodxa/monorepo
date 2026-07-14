/**
 * Edit TCP monitor page controller. Requires `requireUser` + `requireTeam`; 404s when
 * the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import EditTcpMonitorView from "~/resources/views/tcp-monitors/edit";
import routes from "~/routes/web";

/** GET /app/:team/tcp/:monitorId/edit — a TCP monitor's edit form. */
export default createAction(routes.app.team.tcpMonitors.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading="Edit TCP Monitor"
					breadcrumbs={[
						{
							label: "Dashboard",
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: "TCP Monitors",
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
						{
							label: monitor.name,
							href: routes.app.team.tcpMonitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							}),
						},
					]}
				>
					<EditTcpMonitorView team={ctx.team} monitor={monitor} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
});

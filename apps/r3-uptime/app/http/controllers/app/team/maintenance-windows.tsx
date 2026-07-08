/**
 * Maintenance windows list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MaintenanceWindowsView from "~/resources/views/maintenance-windows/index";
import routes from "~/routes/web";

/** GET /app/:team/maintenance — the team's maintenance windows list. */
export default createAction(
	routes.app.team.maintenanceWindows,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let windows = await MaintenanceWindow.listByTeam(db, ctx.team.id);
		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let monitorsById = new Map(monitors.map((monitor) => [monitor.id, monitor]));

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · Maintenance windows`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<MaintenanceWindowsView team={ctx.team} windows={windows} monitorsById={monitorsById} />
					</AppShell>
				),
			}),
		);
	}),
);

/**
 * New maintenance window page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import NewMaintenanceWindowView from "~/resources/views/maintenance-windows/new";
import routes from "~/routes/web";

/** GET /app/:team/maintenance/new — the new maintenance-window form. */
export default createAction(
	routes.app.team.maintenanceWindowNew,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New maintenance window`}>
				<AppShell team={ctx.team} viewer={viewer}>
					<NewMaintenanceWindowView team={ctx.team} monitors={monitors} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
);

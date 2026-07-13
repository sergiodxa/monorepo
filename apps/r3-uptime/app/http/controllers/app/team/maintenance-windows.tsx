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
import { css } from "remix/ui";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MaintenanceWindowsView from "~/resources/views/maintenance-windows/index";
import routes from "~/routes/web";

/** GET /app/:team/maintenance — the team's maintenance windows list. */
export default createAction(routes.app.team.maintenanceWindows.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let windows = await MaintenanceWindow.listByTeam(db, ctx.team.id);
		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let monitorsById = new Map(monitors.map((monitor) => [monitor.id, monitor]));

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Maintenance windows`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					breadcrumb="Maintenance windows"
					actions={
						<a
							href={routes.app.team.maintenanceWindows.new.href({ team: ctx.team.slug })}
							mix={[
								css({
									display: "inline-flex",
									alignItems: "center",
									justifyContent: "center",
									padding: "8px 16px",
									borderRadius: 6,
									border: "1px solid transparent",
									background: "oklch(0.24 0.005 145)",
									color: "#ffffff",
									fontFamily: "inherit",
									fontSize: "0.875rem",
									fontWeight: 500,
									cursor: "pointer",
									textDecoration: "none",
									"&:hover": { background: "oklch(0.32 0.006 145)" },
								}),
							]}
						>
							New maintenance window
						</a>
					}
				>
					<MaintenanceWindowsView team={ctx.team} windows={windows} monitorsById={monitorsById} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
});

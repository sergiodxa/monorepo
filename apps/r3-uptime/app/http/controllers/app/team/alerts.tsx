/**
 * Alerts list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Alert from "~/app/data/alert";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import AlertsView from "~/resources/views/alerts/index";
import routes from "~/routes/web";

/** GET /app/:team/alerts — the team's alerts list. */
export default createAction(
	routes.app.team.alerts,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await Alert.listByTeam(db, ctx.team.id);
		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let monitorsById = new Map(monitors.map((monitor) => [monitor.id, monitor]));

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Alerts`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
				>
					<AlertsView team={ctx.team} alerts={alerts} monitorsById={monitorsById} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
);

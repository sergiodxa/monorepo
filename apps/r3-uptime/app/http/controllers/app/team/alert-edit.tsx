/**
 * Edit alert page controller. Requires `requireUser` + `requireTeam`; 404s when the
 * alert doesn't belong to the current team.
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

import Alert from "~/app/data/alert";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import EditAlertView from "~/resources/views/alerts/edit";
import routes from "~/routes/web";

/** GET /app/:team/alerts/:alertId/edit — an alert's edit form. */
export default createAction(
	routes.app.team.alertEdit,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { alertId } = s.parse(s.object({ alertId: s.string() }), ctx.params);
		let alert = await Alert.findByIdForTeam(db, ctx.team.id, alertId);
		if (!alert) return notFound("Not Found");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${alert.name}`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
				>
					<EditAlertView team={ctx.team} alert={alert} monitors={monitors} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
);

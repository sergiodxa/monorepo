/**
 * Alert history page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import AlertHistoryView from "~/resources/views/alerts/history";
import routes from "~/routes/web";

const HISTORY_LIMIT = 100;

/** GET /app/:team/alert-history — the team's alert delivery history. */
export default createAction(
	routes.app.team.alertHistory,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await Alert.listByTeam(db, ctx.team.id);
		let alertsById = new Map(alerts.map((alert) => [alert.id, alert]));
		let events = await AlertEvent.listByAlertIds(db, [...alertsById.keys()], HISTORY_LIMIT);

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · Alert history`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<AlertHistoryView team={ctx.team} events={events} alertsById={alertsById} />
					</AppShell>
				),
			}),
		);
	}),
);

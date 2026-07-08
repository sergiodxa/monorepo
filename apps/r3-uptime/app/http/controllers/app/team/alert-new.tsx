/**
 * New alert page controller. Requires `requireUser` + `requireTeam`.
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
import NewAlertView from "~/resources/views/alerts/new";
import routes from "~/routes/web";

/** GET /app/:team/alerts/new — the new alert form. */
export default createAction(
	routes.app.team.alertNew,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · New alert`,
				children: (
					<AppShell team={ctx.team} viewer={viewer}>
						<NewAlertView team={ctx.team} monitors={monitors} />
					</AppShell>
				),
			}),
		);
	}),
);

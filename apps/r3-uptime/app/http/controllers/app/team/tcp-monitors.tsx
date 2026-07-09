/**
 * TCP monitors list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorsView from "~/resources/views/tcp-monitors/index";
import routes from "~/routes/web";

/** GET /app/:team/tcp — the team's TCP monitors list. */
export default createAction(
	routes.app.team.tcpMonitors,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await TcpMonitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · TCP monitors`}>
				<AppShell team={ctx.team} viewer={viewer}>
					<TcpMonitorsView team={ctx.team} monitors={monitors} />
				</AppShell>
			</DocumentLayout>,
		);
	}),
);

/**
 * TCP monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
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

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import TcpMonitorShowView from "~/resources/views/tcp-monitors/show";
import routes from "~/routes/web";

/** GET /app/:team/tcp/:monitorId — a TCP monitor's detail page. */
export default createAction(
	routes.app.team.tcpMonitorShow,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await TcpMonitor.listResults(db, monitor.id);
		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "tcp");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
				>
					<TcpMonitorShowView
						team={ctx.team}
						monitor={monitor}
						results={results}
						dailyStats={dailyStats}
					/>
				</AppShell>
			</DocumentLayout>,
		);
	}),
);

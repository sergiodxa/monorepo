/**
 * HTTP monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import { getViewer } from "~/app/http/middleware/auth";
import { getMonitorSparkline } from "~/app/services/analytics";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MonitorShowView from "~/resources/views/monitors/show";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId — a monitor's detail page. */
export default createAction(
	routes.app.team.monitorShow,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let sparklineResult = await getMonitorSparkline(ctx.team.id, monitor.id);
		let sparkline = isFailure(sparklineResult) ? [] : sparklineResult.data;
		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "http");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell team={ctx.team} viewer={viewer}>
					<MonitorShowView
						team={ctx.team}
						monitor={monitor}
						sparkline={sparkline}
						dailyStats={dailyStats}
					/>
				</AppShell>
			</DocumentLayout>,
		);
	}),
);

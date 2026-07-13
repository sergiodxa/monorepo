/**
 * Dashboard tab-panel fragment controller. GET /app/:team/dashboard/panel/:type —
 * loads and renders just the requested monitor type's table, with no document
 * shell, so the dashboard's "dashboard-panel" `Frame` can swap it in without a full
 * page reload. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { MonitorHealth, SparklinePoint } from "~/app/services/analytics";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSparklines, getTeamHttpSummaries } from "~/app/services/analytics";
import DashboardPanelView from "~/resources/views/dashboard-panel";
import routes from "~/routes/web";

const DASHBOARD_TABS = ["http", "dns", "tcp", "cron-jobs"] as const;

/**
 * Short, private cache window on every response — long enough that a
 * `<link rel="prefetch">` for an inactive tab gets reused by the real `Frame` fetch a
 * moment later if the user does click it, short enough that monitor status can't go
 * meaningfully stale for someone who leaves the tab open.
 */
const CACHE_CONTROL = "private, max-age=5";

/** GET /app/:team/dashboard/panel/:type — one monitor-type table, fragment-only. */
export default createAction(routes.app.team.dashboard.panel, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { type } = s.parse(s.object({ type: s.enum_(DASHBOARD_TABS) }), ctx.params);
		let headers = { "Cache-Control": CACHE_CONTROL };

		if (type === "dns") {
			let dnsMonitors = await DnsMonitor.listByTeam(db, ctx.team.id);
			return ctx.render(
				<DashboardPanelView tab="dns" team={ctx.team} dnsMonitors={dnsMonitors} />,
				{ headers },
			);
		}

		if (type === "tcp") {
			let tcpMonitors = await TcpMonitor.listByTeam(db, ctx.team.id);
			return ctx.render(
				<DashboardPanelView tab="tcp" team={ctx.team} tcpMonitors={tcpMonitors} />,
				{ headers },
			);
		}

		if (type === "cron-jobs") {
			let cronJobMonitors = await CronJobMonitor.listByTeam(db, ctx.team.id);
			return ctx.render(
				<DashboardPanelView tab="cron-jobs" team={ctx.team} cronJobMonitors={cronJobMonitors} />,
				{ headers },
			);
		}

		let [monitors, summaries, sparklines] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			getTeamHttpSummaries(ctx.team.id),
			getTeamHttpSparklines(ctx.team.id),
		]);
		let summaryList = isFailure(summaries) ? [] : summaries.data;
		let sparklinesByMonitorId: Map<string, SparklinePoint[]> = isFailure(sparklines)
			? new Map()
			: sparklines.data;
		let healthByMonitorId = new Map(
			summaryList.map((summary) => [summary.monitorId, summary.health]),
		);
		let httpRows = monitors.map((monitor) => ({
			monitor,
			health: healthByMonitorId.get(monitor.id) ?? ("pending" as MonitorHealth),
			sparklinePoints: sparklinesByMonitorId.get(monitor.id) ?? [],
		}));

		return ctx.render(<DashboardPanelView tab="http" team={ctx.team} httpRows={httpRows} />, {
			headers,
		});
	}),
});

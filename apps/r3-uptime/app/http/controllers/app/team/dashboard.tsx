/**
 * Team dashboard controller. Resolves the selected monitor-type tab (query param,
 * falling back to the persisted cookie, then "http"), loads HTTP stat cards and table
 * data from Analytics Engine, and persists the resolved tab back to the cookie so a
 * later visit without `?tab=` remembers it. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { dashboardTab as dashboardTabCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import { getTeamHttpSummaries, type MonitorHealth } from "~/app/services/analytics";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import DashboardView, { type DashboardTab } from "~/resources/views/dashboard";
import routes from "~/routes/web";

const DASHBOARD_TABS: readonly DashboardTab[] = ["http", "dns", "tcp", "cron-jobs"];

function isDashboardTab(value: string | null): value is DashboardTab {
	return value !== null && (DASHBOARD_TABS as readonly string[]).includes(value);
}

interface Toast {
	intent: "success" | "error";
	message: string;
}

/** GET /app/:team/dashboard — the team's dashboard shell. */
export default createAction(
	routes.app.team.dashboard,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let cookieTab = await dashboardTabCookie.parse(ctx.request.headers.get("Cookie"));
		let queryTab = ctx.url.searchParams.get("tab");
		let tab: DashboardTab = isDashboardTab(queryTab)
			? queryTab
			: isDashboardTab(cookieTab)
				? cookieTab
				: "http";

		let toast = ctx.get(Session)?.get("toast") as Toast | undefined;

		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let dnsMonitors = await DnsMonitor.listByTeam(db, ctx.team.id);
		let tcpMonitors = await TcpMonitor.listByTeam(db, ctx.team.id);
		let cronJobMonitors = await CronJobMonitor.listByTeam(db, ctx.team.id);
		let summaries = await getTeamHttpSummaries(ctx.team.id);
		let analyticsUnavailable = isFailure(summaries);
		let summaryList = isFailure(summaries) ? [] : summaries.data;
		let healthByMonitorId = new Map(
			summaryList.map((summary) => [summary.monitorId, summary.health]),
		);

		let httpRows = monitors.map((monitor) => ({
			monitor,
			health: healthByMonitorId.get(monitor.id) ?? ("pending" as MonitorHealth),
		}));

		let totalChecks = summaryList.reduce((sum, summary) => sum + summary.totalChecks, 0);
		let successfulChecks = summaryList.reduce((sum, summary) => sum + summary.successfulChecks, 0);
		let uptimePercent = totalChecks > 0 ? Math.round((successfulChecks / totalChecks) * 100) : null;
		let slowestResponseMs =
			summaryList.length > 0 ? Math.max(...summaryList.map((s) => s.maxResponseTimeMs)) : null;

		let sslMonitors = monitors.filter((monitor) => monitor.ssl_monitoring_enabled);
		let sslCounts = {
			valid: sslMonitors.filter((monitor) => monitor.ssl_status === "valid").length,
			expiring: sslMonitors.filter((monitor) => monitor.ssl_status === "expiring").length,
			expired: sslMonitors.filter((monitor) => monitor.ssl_status === "expired").length,
		};

		let renderDocument = DocumentLayout();
		let headers = new Headers();
		headers.set("Set-Cookie", await dashboardTabCookie.serialize(tab));

		return ctx.render(
			renderDocument({
				title: `${ctx.team.name} · Dashboard`,
				children: (
					<AppShell team={ctx.team} viewer={viewer} toast={toast}>
						<DashboardView
							team={ctx.team}
							tab={tab}
							monitorCount={monitors.length}
							uptimePercent={uptimePercent}
							slowestResponseMs={slowestResponseMs}
							httpRows={httpRows}
							sslCounts={sslCounts}
							dnsMonitors={dnsMonitors}
							tcpMonitors={tcpMonitors}
							cronJobMonitors={cronJobMonitors}
							analyticsUnavailable={analyticsUnavailable}
						/>
					</AppShell>
				),
			}),
			{ headers },
		);
	}),
);

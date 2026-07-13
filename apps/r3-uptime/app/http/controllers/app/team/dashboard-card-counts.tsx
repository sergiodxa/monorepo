/**
 * Dashboard per-monitor-type count stat-card fragment controller (HTTP, DNS, TCP, cron
 * jobs, SSL). GET /app/:team/dashboard/cards/counts — loads every monitor table for
 * the team and computes their status breakdowns, with no document shell, so the
 * dashboard's counts `Frame` can swap it in over its skeleton fallback. Requires
 * `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import DashboardCardCountsView from "~/resources/views/dashboard-card-counts";
import routes from "~/routes/web";

/** GET /app/:team/dashboard/cards/counts — the 5 monitor-type count stat cards, fragment-only. */
export default createAction(routes.app.team.dashboardCardCounts, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();

		let [monitors, dnsMonitors, tcpMonitors, cronJobMonitors, summaries] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
			getTeamHttpSummaries(ctx.team.id),
		]);

		// HTTP up/down state is only recorded per-check in Analytics Engine, not as a
		// column on the `monitors` row (unlike DNS/TCP/cron jobs' `last_status`/`status`),
		// so this card's breakdown comes from the same summaries query as the overview
		// card's uptime percentage, not from `Monitor.listByTeam` alone.
		let summaryList = isFailure(summaries) ? [] : summaries.data;
		let httpCounts = {
			total: monitors.length,
			up: summaryList.filter((summary) => summary.health === "up").length,
			down: summaryList.filter((summary) => summary.health === "down").length,
		};

		let dnsCounts = {
			total: dnsMonitors.length,
			ok: dnsMonitors.filter((monitor) => monitor.last_status === "ok").length,
			changed: dnsMonitors.filter((monitor) => monitor.last_status === "changed").length,
			error: dnsMonitors.filter((monitor) => monitor.last_status === "error").length,
		};

		let tcpCounts = {
			total: tcpMonitors.length,
			up: tcpMonitors.filter((monitor) => monitor.last_status === "up").length,
			down: tcpMonitors.filter(
				(monitor) => monitor.last_status === "down" || monitor.last_status === "timeout",
			).length,
		};

		let cronCounts = {
			total: cronJobMonitors.length,
			healthy: cronJobMonitors.filter((monitor) => monitor.status === "healthy").length,
			late: cronJobMonitors.filter((monitor) => monitor.status === "late").length,
			missed: cronJobMonitors.filter((monitor) => monitor.status === "missed").length,
		};

		let sslMonitors = monitors.filter((monitor) => monitor.ssl_monitoring_enabled);
		let sslCounts = {
			total: sslMonitors.length,
			valid: sslMonitors.filter((monitor) => monitor.ssl_status === "valid").length,
			expiring: sslMonitors.filter((monitor) => monitor.ssl_status === "expiring").length,
			expired: sslMonitors.filter((monitor) => monitor.ssl_status === "expired").length,
		};

		return ctx.render(
			<DashboardCardCountsView
				httpCounts={httpCounts}
				dnsCounts={dnsCounts}
				tcpCounts={tcpCounts}
				cronCounts={cronCounts}
				sslCounts={sslCounts}
			/>,
		);
	}),
});

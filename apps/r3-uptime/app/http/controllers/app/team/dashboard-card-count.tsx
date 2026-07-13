/**
 * Dashboard per-monitor-type count stat-card fragment controller. GET
 * /app/:team/dashboard/cards/count/:resource — loads only the one monitor table
 * named by `:resource` (http, dns, tcp, cron-jobs, or ssl) and renders its `StatCard`
 * directly, with no document shell, so each of the dashboard's five count `Frame`s
 * (one per resource, all pointed at this same parameterized route) can swap in
 * independently over its own skeleton fallback. Requires `requireUser` + `requireTeam`.
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

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

const RESOURCES = ["http", "dns", "tcp", "cron-jobs", "ssl"] as const;

/** GET /app/:team/dashboard/cards/count/:resource — one monitor-type count stat card, fragment-only. */
export default createAction(routes.app.team.dashboard.cards.count, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { resource } = s.parse(s.object({ resource: s.enum_(RESOURCES) }), ctx.params);

		if (resource === "dns") {
			let dnsMonitors = await DnsMonitor.listByTeam(db, ctx.team.id);
			let dnsCounts = {
				total: dnsMonitors.length,
				ok: dnsMonitors.filter((monitor) => monitor.last_status === "ok").length,
				changed: dnsMonitors.filter((monitor) => monitor.last_status === "changed").length,
				error: dnsMonitors.filter((monitor) => monitor.last_status === "error").length,
			};

			return ctx.render(
				<StatCard
					label="DNS Monitors"
					value={
						<>
							{dnsCounts.total}
							<Subtitle>
								{dnsCounts.ok} ok / {dnsCounts.changed} changed / {dnsCounts.error} error
							</Subtitle>
						</>
					}
				/>,
			);
		}

		if (resource === "tcp") {
			let tcpMonitors = await TcpMonitor.listByTeam(db, ctx.team.id);
			let tcpCounts = {
				total: tcpMonitors.length,
				up: tcpMonitors.filter((monitor) => monitor.last_status === "up").length,
				down: tcpMonitors.filter(
					(monitor) => monitor.last_status === "down" || monitor.last_status === "timeout",
				).length,
			};

			return ctx.render(
				<StatCard
					label="TCP Monitors"
					value={
						<>
							{tcpCounts.total}
							<Subtitle>
								{tcpCounts.up} up / {tcpCounts.down} down
							</Subtitle>
						</>
					}
				/>,
			);
		}

		if (resource === "cron-jobs") {
			let cronJobMonitors = await CronJobMonitor.listByTeam(db, ctx.team.id);
			let cronCounts = {
				total: cronJobMonitors.length,
				healthy: cronJobMonitors.filter((monitor) => monitor.status === "healthy").length,
				late: cronJobMonitors.filter((monitor) => monitor.status === "late").length,
				missed: cronJobMonitors.filter((monitor) => monitor.status === "missed").length,
			};

			return ctx.render(
				<StatCard
					label="Cron Jobs"
					value={
						<>
							{cronCounts.total}
							<Subtitle>
								{cronCounts.healthy} healthy / {cronCounts.late} late / {cronCounts.missed} missed
							</Subtitle>
						</>
					}
				/>,
			);
		}

		if (resource === "ssl") {
			let monitors = await Monitor.listByTeam(db, ctx.team.id);
			let sslMonitors = monitors.filter((monitor) => monitor.ssl_monitoring_enabled);
			let sslCounts = {
				total: sslMonitors.length,
				valid: sslMonitors.filter((monitor) => monitor.ssl_status === "valid").length,
				expiring: sslMonitors.filter((monitor) => monitor.ssl_status === "expiring").length,
				expired: sslMonitors.filter((monitor) => monitor.ssl_status === "expired").length,
			};

			return ctx.render(
				<StatCard
					label="SSL Monitors"
					value={
						<>
							{sslCounts.total}
							<Subtitle>
								{sslCounts.valid} valid, {sslCounts.expiring} expiring, {sslCounts.expired} expired
							</Subtitle>
						</>
					}
				/>,
			);
		}

		// HTTP up/down state is only recorded per-check in Analytics Engine, not as a
		// column on the `monitors` row (unlike DNS/TCP/cron jobs' `last_status`/`status`),
		// so this card's breakdown comes from a summaries query rather than
		// `Monitor.listByTeam` alone.
		let [monitors, summaries] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			getTeamHttpSummaries(ctx.team.id),
		]);
		let summaryList = isFailure(summaries) ? [] : summaries.data;
		let httpCounts = {
			total: monitors.length,
			up: summaryList.filter((summary) => summary.health === "up").length,
			down: summaryList.filter((summary) => summary.health === "down").length,
		};

		return ctx.render(
			<StatCard
				label="HTTP Monitors"
				value={
					<>
						{httpCounts.total}
						<Subtitle>
							{httpCounts.up} up / {httpCounts.down} down
						</Subtitle>
					</>
				}
			/>,
		);
	}),
});

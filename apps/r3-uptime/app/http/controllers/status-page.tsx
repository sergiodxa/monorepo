/**
 * Public status page controller. Loads a page by slug — private pages 404, since
 * this route is the page's only access path and `docs/status-pages.md` leaves the
 * private-access story to the reimplementer; this keeps the OLD APP's answer
 * (private pages have no public route at all) rather than inventing a new one.
 * Resolves every attached HTTP/DNS/TCP/cron-job monitor's current status and
 * 365-day heatmap, and combines them into one page-level status.
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

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import {
	computeOverallStatus,
	deriveCronStatus,
	deriveDnsStatus,
	deriveHttpStatus,
	deriveTcpStatus,
} from "~/app/services/status-page";
import DocumentLayout from "~/resources/layouts/document";
import StatusPageView from "~/resources/views/status-pages/public";
import routes from "~/routes/web";

/** GET /status/:slug — the public view of a status page. */
export default createAction(
	routes.statusPage,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

		let page = await StatusPage.findBySlugPublic(db, slug);
		if (!page) return notFound("Not Found");

		let attachments = await StatusPage.listAttachments(db, page.id);

		let [allMonitors, allDnsMonitors, allTcpMonitors, allCronJobs, httpSummaries] =
			await Promise.all([
				Monitor.listByTeam(db, page.team_id),
				DnsMonitor.listByTeam(db, page.team_id),
				TcpMonitor.listByTeam(db, page.team_id),
				CronJobMonitor.listByTeam(db, page.team_id),
				getTeamHttpSummaries(page.team_id),
			]);

		let healthByMonitorId = new Map(
			isFailure(httpSummaries)
				? []
				: httpSummaries.data.map((summary) => [summary.monitorId, summary.health]),
		);
		let monitorsById = new Map(allMonitors.map((monitor) => [monitor.id, monitor]));
		let dnsMonitorsById = new Map(allDnsMonitors.map((monitor) => [monitor.id, monitor]));
		let tcpMonitorsById = new Map(allTcpMonitors.map((monitor) => [monitor.id, monitor]));
		let cronJobsById = new Map(allCronJobs.map((monitor) => [monitor.id, monitor]));

		let httpServices = await Promise.all(
			attachments.monitors
				.map((row) => monitorsById.get(row.monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "http" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveHttpStatus(healthByMonitorId.get(monitor.id) ?? "pending"),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "http"),
				})),
		);

		let dnsServices = await Promise.all(
			attachments.dnsMonitors
				.map((row) => dnsMonitorsById.get(row.dns_monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "dns" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveDnsStatus(monitor.last_status),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "dns"),
				})),
		);

		let tcpServices = await Promise.all(
			attachments.tcpMonitors
				.map((row) => tcpMonitorsById.get(row.tcp_monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "tcp" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveTcpStatus(monitor.last_status),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "tcp"),
				})),
		);

		let cronServices = attachments.cronJobs
			.map((row) => cronJobsById.get(row.cron_job_monitor_id))
			.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
			.map((monitor) => ({
				kind: "cron" as const,
				id: monitor.id,
				name: monitor.name,
				cronExpression: monitor.cron_expression,
				lastPingAt: monitor.last_ping_at,
				status: deriveCronStatus(monitor.status),
			}));

		let overallStatus = computeOverallStatus([
			...httpServices.map((service) => service.status),
			...dnsServices.map((service) => service.status),
			...tcpServices.map((service) => service.status),
			...cronServices.map((service) => service.status),
		]);

		let renderDocument = DocumentLayout();
		return ctx.render(
			renderDocument({
				title: page.title,
				children: (
					<StatusPageView
						page={page}
						overallStatus={overallStatus}
						httpServices={httpServices}
						dnsServices={dnsServices}
						tcpServices={tcpServices}
						cronServices={cronServices}
					/>
				),
			}),
		);
	}),
);

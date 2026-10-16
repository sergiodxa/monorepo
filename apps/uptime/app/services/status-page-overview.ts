/**
 * What a public status page reports, loaded once for the page and for its social card: every
 * attached service with its current status and recent days, and the page's overall status.
 * Flow monitors are read through a projection that leaves their spec, which holds credentials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";

import type { UptimeModels } from "~/app/models";
import type { SelectStatusPage } from "~/database/schema";

import { getTeamHttpSummaries } from "~/app/services/analytics";
import {
	computeOverallStatus,
	deriveCronStatus,
	deriveDnsStatus,
	deriveFlowStatus,
	deriveHttpStatus,
	deriveTcpStatus,
} from "~/app/services/status-page";
import { publicName } from "~/app/services/status-page-maintenance";

/**
 * Loads everything a status page shows about its services. Bar services carry their recent
 * daily stats for the uptime bars; cron jobs carry their schedule and last ping instead.
 */
export async function loadStatusPageOverview(models: UptimeModels, page: SelectStatusPage) {
	let attachments = await models.statusPages.listAttachments(page.id);

	let [allMonitors, allDnsMonitors, allTcpMonitors, allFlowMonitors, allCronJobs, httpSummaries] =
		await Promise.all([
			models.monitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
			models.dnsMonitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
			models.tcpMonitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
			/**
			 * Projected to `id`/`name`/`last_status` in the query itself: a flow's spec source
			 * holds the credentials it signs in with, and this page renders to the world.
			 */
			models.statusPages.listPublicFlowMonitors(page.team_id),
			models.cronJobMonitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
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
	let flowMonitorsById = new Map(allFlowMonitors.map((monitor) => [monitor.id, monitor]));
	let cronJobsById = new Map(allCronJobs.map((monitor) => [monitor.id, monitor]));

	let [httpServices, dnsServices, tcpServices, flowServices] = await Promise.all([
		Promise.all(
			attachments.monitors
				.flatMap((row) => {
					let monitor = monitorsById.get(row.monitor_id);
					return monitor ? [{ displayName: row.display_name, monitor }] : [];
				})
				.map(async ({ displayName, monitor }) => ({
					kind: "http" as const,
					id: monitor.id,
					name: publicName(displayName, monitor.name),
					status: deriveHttpStatus(healthByMonitorId.get(monitor.id) ?? "pending"),
					days: await models.monitorDailyStats.listRecentDays(monitor.id, "http"),
				})),
		),
		Promise.all(
			attachments.dnsMonitors
				.flatMap((row) => {
					let monitor = dnsMonitorsById.get(row.dns_monitor_id);
					return monitor ? [{ displayName: row.display_name, monitor }] : [];
				})
				.map(async ({ displayName, monitor }) => ({
					kind: "dns" as const,
					id: monitor.id,
					name: publicName(displayName, monitor.name),
					status: deriveDnsStatus(monitor.last_status),
					days: await models.monitorDailyStats.listRecentDays(monitor.id, "dns"),
				})),
		),
		Promise.all(
			attachments.tcpMonitors
				.flatMap((row) => {
					let monitor = tcpMonitorsById.get(row.tcp_monitor_id);
					return monitor ? [{ displayName: row.display_name, monitor }] : [];
				})
				.map(async ({ displayName, monitor }) => ({
					kind: "tcp" as const,
					id: monitor.id,
					name: publicName(displayName, monitor.name),
					status: deriveTcpStatus(monitor.last_status),
					days: await models.monitorDailyStats.listRecentDays(monitor.id, "tcp"),
				})),
		),
		Promise.all(
			attachments.flowMonitors
				.flatMap((row) => {
					let monitor = flowMonitorsById.get(row.flow_monitor_id);
					return monitor ? [{ displayName: row.display_name, monitor }] : [];
				})
				.map(async ({ displayName, monitor }) => ({
					kind: "flow" as const,
					id: monitor.id,
					name: publicName(displayName, monitor.name),
					status: deriveFlowStatus(monitor.last_status),
					days: await models.monitorDailyStats.listRecentDays(monitor.id, "flow"),
				})),
		),
	]);

	let cronServices = attachments.cronJobs
		.flatMap((row) => {
			let monitor = cronJobsById.get(row.cron_job_monitor_id);
			return monitor ? [{ displayName: row.display_name, monitor }] : [];
		})
		.map(({ displayName, monitor }) => ({
			kind: "cron" as const,
			id: monitor.id,
			name: publicName(displayName, monitor.name),
			cronExpression: monitor.cron_expression,
			lastPingAt: monitor.last_ping_at,
			status: deriveCronStatus(monitor.status),
		}));

	let overallStatus = computeOverallStatus([
		...httpServices.map((service) => service.status),
		...dnsServices.map((service) => service.status),
		...tcpServices.map((service) => service.status),
		...flowServices.map((service) => service.status),
		...cronServices.map((service) => service.status),
	]);

	let barServices = [...httpServices, ...dnsServices, ...tcpServices, ...flowServices];

	return { barServices, cronServices, overallStatus };
}

/** What {@link loadStatusPageOverview} reports about a page's services. */
export type StatusPageOverview = Awaited<ReturnType<typeof loadStatusPageOverview>>;

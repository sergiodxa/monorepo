import type { TFunction } from "i18next";

import { isBefore, subDays } from "date-fns";

import type { Database } from "~/db/index";

import CronJobMonitor from "~/models/cron-job-monitor";

export async function getDashboardDataByTeamId(args: {
	db: Database;
	teamId: string;
	locale: string;
	timeZone?: string;
	t: TFunction<"translation", "page.dashboard.table">;
}) {
	// Fetch all data in parallel
	let [monitors, dnsMonitorsList, tcpMonitorsList, cronJobsList] = await Promise.all([
		// HTTP monitors with results from the last day
		args.db.query.monitors.findMany({
			columns: {
				id: true,
				name: true,
				expectedStatus: true,
				degradedAfterMs: true,
			},
			where(fields, operators) {
				return operators.eq(fields.teamId, args.teamId);
			},
			with: {
				results: {
					columns: {
						responseTimeMs: true,
						responseStatus: true,
						completedAt: true,
					},
					where(fields, operators) {
						return operators.and(
							operators.isNotNull(fields.completedAt),
							operators.gte(fields.completedAt, subDays(new Date(), 1)),
						);
					},
				},
			},
		}),
		// DNS monitors
		args.db.query.dnsMonitors.findMany({
			columns: {
				id: true,
				name: true,
				domain: true,
				recordType: true,
				lastStatus: true,
				lastCheckedAt: true,
				lastValue: true,
			},
			where(fields, operators) {
				return operators.eq(fields.teamId, args.teamId);
			},
		}),
		// TCP monitors
		args.db.query.tcpMonitors.findMany({
			columns: {
				id: true,
				name: true,
				host: true,
				port: true,
				lastStatus: true,
				lastResponseTimeMs: true,
				lastCheckedAt: true,
			},
			where(fields, operators) {
				return operators.eq(fields.teamId, args.teamId);
			},
		}),
		// Cron job monitors
		args.db.query.cronJobMonitors.findMany({
			columns: {
				id: true,
				name: true,
				cronExpression: true,
				status: true,
				lastPingAt: true,
				nextExpectedAt: true,
			},
			where(fields, operators) {
				return operators.eq(fields.teamId, args.teamId);
			},
		}),
	]);

	// HTTP monitors data
	let httpMonitorsCount = monitors.length;

	let allResults = monitors.flatMap((m) =>
		m.results.map((r) => ({
			...r,
			monitorId: m.id,
			expectedStatus: m.expectedStatus,
			degradedAfterMs: m.degradedAfterMs,
		})),
	);

	// Uptime
	let totalChecks = allResults.length;
	let upChecks = allResults.filter((r) => r.responseStatus === r.expectedStatus).length;
	let uptime = totalChecks > 0 ? upChecks / totalChecks : 1;

	// Slowest endpoint
	let slowestResult = allResults
		.filter((r) => r.completedAt)
		.sort((a, b) => (b.responseTimeMs ?? 0) - (a.responseTimeMs ?? 0))[0];
	let slowestEndpoint = slowestResult
		? {
				responseTimeMs: slowestResult.responseTimeMs,
				monitorName: monitors.find((m) => m.id === slowestResult.monitorId)?.name ?? null,
			}
		: null;

	// HTTP monitors with aggregated data
	let monitorsWithData = monitors.map((m) => {
		let lastResult =
			m.results
				.filter((r) => Boolean(r.completedAt))
				.sort((a, b) => {
					if (!a.completedAt && !b.completedAt) return 0;
					if (!a.completedAt) return 1;
					if (!b.completedAt) return -1;
					return isBefore(a.completedAt, b.completedAt) ? 1 : -1;
				})[0] ?? null;

		let responseTime = lastResult?.responseTimeMs ?? null;
		let avgResponseTime =
			m.results
				.map((r) => r.responseTimeMs)
				.filter(Boolean)
				.reduce((sum, n) => sum + n, 0) / (m.results.length || 1);

		let status = lastResult
			? lastResult.responseStatus !== m.expectedStatus
				? ("down" as const)
				: (responseTime ?? 0) >= m.degradedAfterMs
					? ("degraded" as const)
					: ("up" as const)
			: ("unknown" as const);

		let lastIncident = m.results
			.filter((r) => r.responseStatus !== m.expectedStatus)
			.map((r) => r.completedAt)
			.filter(Boolean)
			.sort((a, b) => (isBefore(a, b) ? 1 : -1))[0];

		let latency = downsample(m.results.map((r) => r.responseTimeMs).filter(Boolean), 100).map(
			(latency) => ({ latency }),
		);

		return {
			id: m.id,
			name: m.name,
			status,
			latency,
			lastIncident: lastIncident
				? lastIncident.toLocaleString(args.locale, {
						timeStyle: "short",
						dateStyle: "short",
						timeZone: args.timeZone ?? "UTC",
					})
				: null,
			responseTime: args.t("responseTime", {
				value: avgResponseTime.toLocaleString(args.locale, {
					style: "unit",
					unit: "millisecond",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			}),
		};
	});

	// HTTP monitor status counts
	let httpMonitorsUp = monitorsWithData.filter((m) => m.status === "up").length;
	let httpMonitorsDown = monitorsWithData.filter((m) => m.status === "down").length;

	// DNS monitors data
	let dnsMonitorsCount = dnsMonitorsList.length;
	let dnsMonitorsOk = dnsMonitorsList.filter((m) => m.lastStatus === "ok").length;
	let dnsMonitorsChanged = dnsMonitorsList.filter((m) => m.lastStatus === "changed").length;
	let dnsMonitorsError = dnsMonitorsList.filter((m) => m.lastStatus === "error").length;

	let dnsMonitors = dnsMonitorsList.map((m) => ({
		id: m.id,
		name: m.name,
		domain: m.domain,
		recordType: m.recordType,
		lastStatus: m.lastStatus,
		lastCheckedAt: m.lastCheckedAt
			? m.lastCheckedAt.toLocaleString(args.locale, {
					timeStyle: "short",
					dateStyle: "short",
					timeZone: args.timeZone ?? "UTC",
				})
			: null,
		lastValue: m.lastValue,
	}));

	// TCP monitors data
	let tcpMonitorsCount = tcpMonitorsList.length;
	let tcpMonitorsUp = tcpMonitorsList.filter((m) => m.lastStatus === "up").length;
	let tcpMonitorsDown = tcpMonitorsList.filter(
		(m) => m.lastStatus === "down" || m.lastStatus === "timeout",
	).length;

	let tcpMonitors = tcpMonitorsList.map((m) => ({
		id: m.id,
		name: m.name,
		host: m.host,
		port: m.port,
		lastStatus: m.lastStatus,
		lastResponseTimeMs: m.lastResponseTimeMs,
		lastCheckedAt: m.lastCheckedAt
			? m.lastCheckedAt.toLocaleString(args.locale, {
					timeStyle: "short",
					dateStyle: "short",
					timeZone: args.timeZone ?? "UTC",
				})
			: null,
	}));

	// Cron jobs data
	let cronJobsCount = cronJobsList.length;
	let cronJobsHealthy = cronJobsList.filter((m) => m.status === "healthy").length;
	let cronJobsLate = cronJobsList.filter((m) => m.status === "late").length;
	let cronJobsMissed = cronJobsList.filter((m) => m.status === "missed").length;
	let cronJobsNew = cronJobsList.filter((m) => m.status === "new").length;

	let cronJobs = cronJobsList.map((m) => ({
		id: m.id,
		name: m.name,
		schedule: CronJobMonitor.describeCronExpression(m.cronExpression),
		status: m.status,
		lastPingAt: m.lastPingAt
			? m.lastPingAt.toLocaleString(args.locale, {
					timeStyle: "short",
					dateStyle: "short",
					timeZone: args.timeZone ?? "UTC",
				})
			: null,
		nextExpectedAt: m.nextExpectedAt
			? m.nextExpectedAt.toLocaleString(args.locale, {
					timeStyle: "short",
					dateStyle: "short",
					timeZone: args.timeZone ?? "UTC",
				})
			: null,
	}));

	return {
		// HTTP
		httpMonitorsCount,
		httpMonitorsUp,
		httpMonitorsDown,
		uptime,
		slowestEndpoint,
		httpMonitors: monitorsWithData,

		// DNS
		dnsMonitors,
		dnsMonitorsCount,
		dnsMonitorsOk,
		dnsMonitorsChanged,
		dnsMonitorsError,

		// TCP
		tcpMonitors,
		tcpMonitorsCount,
		tcpMonitorsUp,
		tcpMonitorsDown,

		// Cron Jobs
		cronJobs,
		cronJobsCount,
		cronJobsHealthy,
		cronJobsLate,
		cronJobsMissed,
		cronJobsNew,
	};
}

function downsample(sample: number[], maxPoints = 20) {
	if (sample.length === 0) {
		return Array.from({ length: maxPoints }).fill(0);
	}

	if (sample.length === 1) {
		return Array.from({ length: maxPoints }).fill(sample[0] ?? 0);
	}

	if (sample.length <= maxPoints) return sample;

	let result: number[] = [];
	let step = sample.length / maxPoints;

	for (let i = 0; i < maxPoints; i++) {
		let start = Math.floor(i * step);
		let end = Math.floor((i + 1) * step);
		let chunk = sample.slice(start, end);
		let avg = chunk.reduce((sum, n) => sum + n, 0) / (chunk.length || 1);
		result.push(avg);
	}

	return result;
}

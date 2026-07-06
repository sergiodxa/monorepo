/**
 * Server-side data queries backing the team dashboard. It exposes per-type fetchers
 * (getHttpMonitorsData, getDnsMonitorsData, getTcpMonitorsData, getCronJobsData,
 * getSslMonitorsData) that read monitors from the database and, for HTTP, aggregate cached
 * analytics into uptime, latency samples and slowest-endpoint figures. It centralises this
 * shaping so the route loader can stream ready-to-render summaries, wrapped in server-timing
 * measurement via a local query() helper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "i18next";

import { isFailure } from "@pkg/result";

import type { Database } from "~/db/index";

import { measure } from "~/middleware/server-timing";
import CronJobMonitor from "~/models/cron-job-monitor";
import { buildCacheKey, getCacheTtl, queryAnalyticsCached } from "~/services/analytics.server";

interface BaseArgs {
	db: Database;
	teamId: string;
	locale: string;
	timeZone?: string;
}

interface HttpMonitorsArgs extends BaseArgs {
	t: TFunction<"translation", "page.dashboard.table">;
}

export const getHttpMonitorsData = query(async (args: HttpMonitorsArgs) => {
	let monitors = await args.db.query.monitors.findMany({
		columns: {
			id: true,
			name: true,
			expectedStatus: true,
			degradedAfterMs: true,
			intervalSeconds: true,
		},
		where(fields, operators) {
			return operators.eq(fields.teamId, args.teamId);
		},
	});

	let httpMonitorsCount = monitors.length;
	let minIntervalSeconds = Math.min(...(monitors.map((m) => m.intervalSeconds) as number[]), 300);
	if (!Number.isFinite(minIntervalSeconds)) minIntervalSeconds = 60;
	let ttl = getCacheTtl(minIntervalSeconds);

	let analyticsError: string | null = null;
	let aggregates: Array<{
		monitorId: string;
		totalChecks: number;
		upChecks: number;
		avgResponseTime: number | null;
		maxResponseTime: number | null;
	}> = [];

	let samples: Array<{
		monitorId: string;
		responseTimeMs: number | null;
		status: string;
		timestamp: string;
	}> = [];

	let aggSql = `SELECT
		blob1 AS monitorId,
		SUM(double2) AS totalChecks,
		SUMIf(double2, blob3 = 'up') AS upChecks,
		AVG(double1) AS avgResponseTime,
		MAX(double1) AS maxResponseTime
	FROM uptime_monitor_results
	WHERE index1 = '${args.teamId}'
		AND blob2 = 'http'
		AND timestamp >= NOW() - INTERVAL '24' HOUR
	GROUP BY monitorId`;

	let samplesSql = `SELECT
		blob1 AS monitorId,
		double1 AS responseTimeMs,
		blob3 AS status,
		timestamp
	FROM uptime_monitor_results
	WHERE index1 = '${args.teamId}'
		AND blob2 = 'http'
		AND timestamp >= NOW() - INTERVAL '24' HOUR
	ORDER BY timestamp DESC
	LIMIT 5000`;

	let aggResult = await queryAnalyticsCached<{
		monitorId: string;
		totalChecks: number;
		upChecks: number;
		avgResponseTime: number | null;
		maxResponseTime: number | null;
	}>(buildCacheKey(args.teamId, "http-agg"), ttl, aggSql);
	if (isFailure(aggResult)) {
		analyticsError = aggResult.error.message;
	} else {
		aggregates = aggResult.data;
	}

	let samplesResult = await queryAnalyticsCached<{
		monitorId: string;
		responseTimeMs: number | null;
		status: string;
		timestamp: string;
	}>(buildCacheKey(args.teamId, "http-samples"), ttl, samplesSql);
	if (isFailure(samplesResult)) {
		analyticsError = analyticsError ?? samplesResult.error.message;
	} else {
		samples = samplesResult.data;
	}

	let aggregateMap = new Map(aggregates.map((a) => [a.monitorId, a]));
	let samplesByMonitor = samples.reduce<Record<string, typeof samples>>(function (acc, sample) {
		(acc[sample.monitorId] ||= []).push(sample);
		return acc;
	}, {});

	let totalChecks = aggregates.reduce((sum, a) => sum + a.totalChecks, 0);
	let upChecks = aggregates.reduce((sum, a) => sum + a.upChecks, 0);
	let uptime = totalChecks > 0 ? upChecks / totalChecks : 1;

	let slowestAgg = aggregates
		.filter((a) => a.maxResponseTime !== null)
		.sort((a, b) => (b.maxResponseTime ?? 0) - (a.maxResponseTime ?? 0))[0];
	let slowestEndpoint = slowestAgg
		? {
				responseTimeMs: slowestAgg.maxResponseTime,
				monitorName: monitors.find((m) => m.id === slowestAgg.monitorId)?.name ?? null,
			}
		: null;

	let httpMonitors = monitors.map((m) => {
		let agg = aggregateMap.get(m.id);
		let monitorSamples = samplesByMonitor[m.id] ?? [];
		let latestSample = monitorSamples[0];
		let status = latestSample
			? latestSample.status === "up"
				? ("up" as const)
				: latestSample.status === "timeout"
					? ("down" as const)
					: ("down" as const)
			: ("unknown" as const);

		let lastIncidentSample = monitorSamples.find((s) => s.status !== "up");
		let lastIncident = lastIncidentSample
			? new Date(lastIncidentSample.timestamp).toLocaleString(args.locale, {
					timeStyle: "short",
					dateStyle: "short",
					timeZone: args.timeZone ?? "UTC",
				})
			: null;

		let latencyValues = monitorSamples
			.map((s) => s.responseTimeMs)
			.filter((n): n is number => n != null);
		let latency = downsample(latencyValues, 100).map((latency) => ({ latency }));

		let avgResponseTime = agg?.avgResponseTime ?? null;

		return {
			id: m.id,
			name: m.name,
			status,
			latency,
			lastIncident,
			responseTime: avgResponseTime
				? args.t("responseTime", {
						value: avgResponseTime.toLocaleString(args.locale, {
							style: "unit",
							unit: "millisecond",
							minimumFractionDigits: 0,
							maximumFractionDigits: 0,
						}),
					})
				: args.t("responseTime", { value: "–" }),
		};
	});

	let httpMonitorsUp = httpMonitors.filter((m) => m.status === "up").length;
	let httpMonitorsDown = httpMonitors.filter((m) => m.status === "down").length;

	return {
		httpMonitors,
		httpMonitorsCount,
		httpMonitorsUp,
		httpMonitorsDown,
		uptime,
		slowestEndpoint,
		analyticsError,
	};
}, "getHttpMonitorsData");

export const getDnsMonitorsData = query(async (args: BaseArgs) => {
	let dnsMonitorsList = await args.db.query.dnsMonitors.findMany({
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
	});

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

	return {
		dnsMonitors,
		dnsMonitorsCount,
		dnsMonitorsOk,
		dnsMonitorsChanged,
		dnsMonitorsError,
	};
}, "getDnsMonitorsData");

export const getTcpMonitorsData = query(async (args: BaseArgs) => {
	let tcpMonitorsList = await args.db.query.tcpMonitors.findMany({
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
	});

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

	return {
		tcpMonitors,
		tcpMonitorsCount,
		tcpMonitorsUp,
		tcpMonitorsDown,
	};
}, "getTcpMonitorsData");

export const getCronJobsData = query(async (args: BaseArgs) => {
	let cronJobsList = await args.db.query.cronJobMonitors.findMany({
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
	});

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
		cronJobs,
		cronJobsCount,
		cronJobsHealthy,
		cronJobsLate,
		cronJobsMissed,
		cronJobsNew,
	};
}, "getCronJobsData");

export const getSslMonitorsData = query(async (args: BaseArgs) => {
	let sslMonitors = await args.db.query.sslMonitors.findMany({
		columns: {
			id: true,
			status: true,
		},
		where(fields, operators) {
			return operators.eq(fields.teamId, args.teamId);
		},
	});

	let sslMonitorsCount = sslMonitors.length;
	let sslMonitorsValid = sslMonitors.filter((m) => m.status === "valid").length;
	let sslMonitorsExpiring = sslMonitors.filter((m) => m.status === "expiring").length;
	let sslMonitorsExpired = sslMonitors.filter((m) => m.status === "expired").length;

	return {
		sslMonitorsCount,
		sslMonitorsValid,
		sslMonitorsExpiring,
		sslMonitorsExpired,
	};
}, "getSslMonitorsData");

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

type QueryFunction<Args extends any[], Output> = (...args: Args) => Promise<Output>;

function query<Args extends any[], Output>(fn: QueryFunction<Args, Output>, name?: string) {
	return (...args: Args): Promise<Output> => measure(name || fn.name, () => fn(...args));
}

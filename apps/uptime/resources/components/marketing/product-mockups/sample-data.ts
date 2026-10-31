/**
 * Example data the product mockups draw: monitors on `example.com` hosts, their response
 * times and a generated 90-day uptime history. It is product UI filled in for a picture,
 * so every name is a placeholder host or role and never a customer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { lastNDays } from "@sdxc/dates";

import type { SparklinePoint } from "~/app/services/analytics";
import type { SelectMonitorDailyStats } from "~/database/schema";

import { UPTIME_WINDOW_DAYS } from "~/app/models/monitor-daily-stats";

/** An example HTTP monitor: its host, average latency and recent response times, oldest first. */
export interface SampleMonitor {
	host: string;
	tone: "up" | "degraded" | "down";
	averageMs: number;
	times: readonly number[];
}

/** The monitors the dashboard and the feature-card scenes list, in that order. */
export const SAMPLE_MONITORS: readonly SampleMonitor[] = [
	{
		host: "api.example.com/health",
		tone: "up",
		averageMs: 184,
		times: [182, 176, 190, 171, 205, 188, 179, 184, 176, 192, 181, 174],
	},
	{
		host: "example.com",
		tone: "up",
		averageMs: 101,
		times: [96, 102, 99, 141, 118, 104, 97, 101, 95, 99, 103, 98],
	},
	{
		host: "app.example.com/login",
		tone: "degraded",
		averageMs: 642,
		times: [312, 298, 305, 290, 336, 301, 296, 488, 709, 812, 760, 694],
	},
	{
		host: "cdn.example.com",
		tone: "up",
		averageMs: 38,
		times: [41, 39, 36, 40, 38, 35, 37, 42, 39, 36, 38, 37],
	},
];

/** Failed checks out of a day's 1,440 that each daily status draws with. */
const FAILED_CHECKS: Record<SampleMonitor["tone"], number> = {
	up: 0,
	degraded: 6,
	down: 42,
};

/**
 * Turns a run of response times into the points `Sparkline` draws; the timestamps only
 * key the points, since a sparkline spaces them evenly.
 */
export function sparklinePoints(times: readonly number[]): SparklinePoint[] {
	return times.map((responseTimeMs, index) => ({ timestamp: String(index), responseTimeMs }));
}

/**
 * A 90-day history ending today in UTC, one row per day, so `UptimeBar` draws it like a
 * real monitor's. `degraded` and `down` list the days, counted back from today, that
 * show those states; every other day is fully up.
 */
export function sampleDailyStats(
	monitorId: string,
	incidents: { degraded?: readonly number[]; down?: readonly number[] } = {},
): SelectMonitorDailyStats[] {
	let days = lastNDays(UPTIME_WINDOW_DAYS, { timeZone: "UTC" });
	return days.map((day, index) => {
		let daysAgo = days.length - 1 - index;
		let status: SampleMonitor["tone"] = "up";
		if (incidents.down?.includes(daysAgo)) status = "down";
		else if (incidents.degraded?.includes(daysAgo)) status = "degraded";
		let failed = FAILED_CHECKS[status];
		return {
			id: `${monitorId}-${day.key}`,
			created_at: 0,
			monitor_id: monitorId,
			monitor_type: "http",
			date: day.key,
			total_checks: 1440,
			successful_checks: 1440 - failed,
			failed_checks: failed,
			avg_response_time_ms: 180,
			max_response_time_ms: 420,
			p95_response_time_ms: 310,
			status,
		};
	});
}

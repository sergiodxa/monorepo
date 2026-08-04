/**
 * Tests for the trial-to-monitor history rollup. Every case pins a check at a fixed instant
 * rather than relative to now, so the day boundaries under test are the same boundaries on
 * every run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { HistoricCheck } from "~/app/lib/trial-history";

import { dailyStatsFromChecks } from "~/app/lib/trial-history";

/** A check at a given UTC instant, so each case reads as the day it is about. */
function check(iso: string, status: HistoricCheck["status"], ms: number | null): HistoricCheck {
	return { status, response_time_ms: ms, checked_at: new Date(iso).getTime() };
}

describe("dailyStatsFromChecks", () => {
	test("returns no rows for no checks", () => {
		expect(dailyStatsFromChecks([], "monitor-1")).toEqual([]);
	});

	test("rolls a day's checks into one row", () => {
		let rows = dailyStatsFromChecks(
			[
				check("2026-03-10T01:00:00Z", "up", 100),
				check("2026-03-10T02:00:00Z", "up", 300),
				check("2026-03-10T03:00:00Z", "down", null),
			],
			"monitor-1",
		);

		expect(rows).toHaveLength(1);
		expect(rows[0]).toEqual({
			monitor_id: "monitor-1",
			monitor_type: "http",
			date: "2026-03-10",
			total_checks: 3,
			successful_checks: 2,
			failed_checks: 1,
			avg_response_time_ms: 200,
			max_response_time_ms: 300,
			status: "degraded",
		});
	});

	test("splits checks across the days they fall in, oldest first", () => {
		let rows = dailyStatsFromChecks(
			[
				check("2026-03-11T00:30:00Z", "up", 120),
				check("2026-03-09T23:30:00Z", "up", 110),
				check("2026-03-10T12:00:00Z", "up", 130),
			],
			"monitor-1",
		);

		expect(rows.map((row) => row.date)).toEqual(["2026-03-09", "2026-03-10", "2026-03-11"]);
	});

	/**
	 * A day nothing answered on must not average to zero — the same rule `watchStats` follows,
	 * so the carried history and the trial's own report cannot disagree about the same day.
	 */
	test("reports no average or maximum when nothing answered", () => {
		let rows = dailyStatsFromChecks(
			[check("2026-03-10T01:00:00Z", "down", null), check("2026-03-10T02:00:00Z", "down", null)],
			"monitor-1",
		);

		expect(rows[0]?.avg_response_time_ms).toBeNull();
		expect(rows[0]?.max_response_time_ms).toBeNull();
		expect(rows[0]?.status).toBe("down");
	});

	/**
	 * Averaging over only the checks that answered. Including the failures as zeroes would
	 * report a day that was half down as twice as fast as it was.
	 */
	test("averages only the checks that reported a time", () => {
		let rows = dailyStatsFromChecks(
			[check("2026-03-10T01:00:00Z", "up", 200), check("2026-03-10T02:00:00Z", "down", null)],
			"monitor-1",
		);

		expect(rows[0]?.avg_response_time_ms).toBe(200);
	});

	/** A degraded check counts against the day, exactly as it does for a paying monitor. */
	test("counts only up as successful", () => {
		let rows = dailyStatsFromChecks([check("2026-03-10T01:00:00Z", "degraded", 9000)], "monitor-1");

		expect(rows[0]?.successful_checks).toBe(0);
		expect(rows[0]?.failed_checks).toBe(1);
		expect(rows[0]?.status).toBe("down");
	});

	test("a fully-up day is up", () => {
		let rows = dailyStatsFromChecks(
			[check("2026-03-10T01:00:00Z", "up", 100), check("2026-03-10T02:00:00Z", "up", 100)],
			"monitor-1",
		);

		expect(rows[0]?.status).toBe("up");
	});

	/** A week of hourly checks is what a real converted watch hands over. */
	test("covers a seven-day hourly watch as seven rows", () => {
		let checks: HistoricCheck[] = [];
		let start = new Date("2026-03-01T00:00:00Z").getTime();

		for (let hour = 0; hour < 24 * 7; hour++) {
			checks.push({
				status: "up",
				response_time_ms: 150,
				checked_at: start + hour * 60 * 60 * 1000,
			});
		}

		let rows = dailyStatsFromChecks(checks, "monitor-1");

		expect(rows).toHaveLength(7);
		expect(rows.every((row) => row.total_checks === 24)).toBe(true);
		expect(rows.every((row) => row.status === "up")).toBe(true);
	});
});

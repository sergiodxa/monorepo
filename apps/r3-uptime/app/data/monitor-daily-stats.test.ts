/**
 * Unit tests for `MonitorDailyStats`: the delete-then-insert idempotency of
 * `upsertDay` (the table has no unique constraint on `(monitor_id, monitor_type,
 * date)`, so a re-run must replace rather than duplicate), the current-year filter
 * on `listForCurrentYear`, and the pure helpers `calculateDailyStatus`,
 * `getYesterdayDateUtc`, and `utcDayBounds`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import MonitorDailyStats, {
	calculateDailyStatus,
	getYesterdayDateUtc,
	utcDayBounds,
} from "~/app/data/monitor-daily-stats";
import { createTestDatabase } from "~/app/lib/test/db";

/** A valid `upsertDay` input, with any field overridable per test. */
function dailyStatsInput(
	overrides: Partial<Parameters<typeof MonitorDailyStats.upsertDay>[1]> = {},
) {
	return {
		monitor_id: crypto.randomUUID(),
		monitor_type: "http" as const,
		date: "2026-03-01",
		total_checks: 100,
		successful_checks: 100,
		failed_checks: 0,
		avg_response_time_ms: 120,
		max_response_time_ms: 300,
		status: "up" as const,
		...overrides,
	};
}

describe("MonitorDailyStats.upsertDay", () => {
	test("creates a row when none exists for that monitor/type/date", async () => {
		let { db } = createTestDatabase();
		let input = dailyStatsInput();

		let row = await MonitorDailyStats.upsertDay(db, input);

		expect(row.monitor_id).toBe(input.monitor_id);
		expect(row.monitor_type).toBe("http");
		expect(row.date).toBe("2026-03-01");
		expect(row.total_checks).toBe(100);
		expect(row.p95_response_time_ms).toBeNull();
	});

	test("replaces the existing row instead of duplicating it on a re-run", async () => {
		let { db } = createTestDatabase();
		let input = dailyStatsInput({ total_checks: 100, successful_checks: 100, failed_checks: 0 });

		let first = await MonitorDailyStats.upsertDay(db, input);
		let second = await MonitorDailyStats.upsertDay(db, {
			...input,
			total_checks: 50,
			successful_checks: 40,
			failed_checks: 10,
			status: "degraded",
		});

		let rows = await MonitorDailyStats.listForCurrentYear(db, input.monitor_id, "http");
		let sameDay = rows.filter((row) => row.date === input.date);
		expect(sameDay).toHaveLength(1);
		expect(sameDay[0]?.id).toBe(second.id);
		expect(sameDay[0]?.id).not.toBe(first.id);
		expect(sameDay[0]?.total_checks).toBe(50);
		expect(sameDay[0]?.status).toBe("degraded");
	});

	test("leaves a different date's row for the same monitor untouched", async () => {
		let { db } = createTestDatabase();
		let monitorId = crypto.randomUUID();
		let dayOne = await MonitorDailyStats.upsertDay(
			db,
			dailyStatsInput({ monitor_id: monitorId, date: "2026-03-01" }),
		);
		await MonitorDailyStats.upsertDay(
			db,
			dailyStatsInput({ monitor_id: monitorId, date: "2026-03-02" }),
		);

		let rows = await MonitorDailyStats.listForCurrentYear(db, monitorId, "http");
		let untouched = rows.find((row) => row.date === "2026-03-01");
		expect(untouched?.id).toBe(dayOne.id);
	});

	test("leaves a different monitor_type's row for the same monitor/date untouched", async () => {
		let { db } = createTestDatabase();
		let monitorId = crypto.randomUUID();
		let httpRow = await MonitorDailyStats.upsertDay(
			db,
			dailyStatsInput({ monitor_id: monitorId, monitor_type: "tcp", date: "2026-03-01" }),
		);
		await MonitorDailyStats.upsertDay(
			db,
			dailyStatsInput({ monitor_id: monitorId, monitor_type: "dns", date: "2026-03-01" }),
		);

		let tcpRows = await MonitorDailyStats.listForCurrentYear(db, monitorId, "tcp");
		expect(tcpRows.map((row) => row.id)).toEqual([httpRow.id]);
	});
});

describe("MonitorDailyStats.listForCurrentYear", () => {
	test("returns rows for the current calendar year only, oldest first", async () => {
		let { db } = createTestDatabase();
		let monitorId = crypto.randomUUID();
		let currentYear = new Date().getUTCFullYear();

		await MonitorDailyStats.upsertDay(
			db,
			dailyStatsInput({ monitor_id: monitorId, date: `${currentYear - 1}-12-31` }),
		);
		let june = await MonitorDailyStats.upsertDay(
			db,
			dailyStatsInput({ monitor_id: monitorId, date: `${currentYear}-06-15` }),
		);
		let january = await MonitorDailyStats.upsertDay(
			db,
			dailyStatsInput({ monitor_id: monitorId, date: `${currentYear}-01-01` }),
		);

		let rows = await MonitorDailyStats.listForCurrentYear(db, monitorId, "http");
		expect(rows.map((row) => row.id)).toEqual([january.id, june.id]);
	});

	test("returns an empty array when the monitor has no stats", async () => {
		let { db } = createTestDatabase();
		expect(await MonitorDailyStats.listForCurrentYear(db, crypto.randomUUID(), "http")).toEqual([]);
	});

	test("never mixes another monitor's rows in", async () => {
		let { db } = createTestDatabase();
		let monitorA = crypto.randomUUID();
		let monitorB = crypto.randomUUID();
		await MonitorDailyStats.upsertDay(db, dailyStatsInput({ monitor_id: monitorA }));

		expect(await MonitorDailyStats.listForCurrentYear(db, monitorB, "http")).toEqual([]);
	});
});

describe("calculateDailyStatus", () => {
	test("is down when there were no checks at all", () => {
		expect(calculateDailyStatus(0, 0)).toBe("down");
	});

	test("is up when every check succeeded", () => {
		expect(calculateDailyStatus(10, 10)).toBe("up");
	});

	test("is degraded when at least half, but not all, checks succeeded", () => {
		expect(calculateDailyStatus(5, 10)).toBe("degraded");
		expect(calculateDailyStatus(9, 10)).toBe("degraded");
	});

	test("is down when fewer than half the checks succeeded", () => {
		expect(calculateDailyStatus(4, 10)).toBe("down");
		expect(calculateDailyStatus(0, 10)).toBe("down");
	});
});

describe("getYesterdayDateUtc", () => {
	test("returns the UTC calendar date 24 hours before `now`", () => {
		expect(getYesterdayDateUtc(Date.parse("2026-03-02T12:00:00.000Z"))).toBe("2026-03-01");
	});

	test("crosses a month boundary correctly", () => {
		expect(getYesterdayDateUtc(Date.parse("2026-03-01T00:30:00.000Z"))).toBe("2026-02-28");
	});
});

describe("utcDayBounds", () => {
	test("returns the [start, end) epoch-ms bounds of a UTC calendar day", () => {
		let { start, end } = utcDayBounds("2026-03-01");
		expect(start).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
		expect(end).toBe(Date.parse("2026-03-02T00:00:00.000Z"));
		expect(end - start).toBe(24 * 60 * 60 * 1000);
	});
});

/**
 * Unit tests for `AggregateDailyStatsJob.perform()`, covering the branching across its
 * four aggregation sources (HTTP via Analytics Engine, DNS/TCP via their own D1 result
 * tables, cron via `cron_job_pings`) and `MonitorDailyStats.upsertDay`'s
 * replace-on-rerun idempotency. `getHttpDailyAggregate` is mocked since Analytics
 * Engine access has its own service-level tests. The DNS/TCP/cron branches read via raw
 * `db.exec()` SELECTs, which the shared `createTestDatabase()` SQLite adapter can't
 * return rows for (its `shouldReadStatement` always treats `"raw"` operations as
 * writes), so those tests patch `db.exec` on the test's own database instance to return
 * canned aggregate rows, exercising the job's write/rounding/status-classification
 * plumbing without re-verifying the SQL's own date-bounds filtering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { BatchedLogger } from "@pkg/logger";
import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { DailyStatsInput } from "~/app/data/monitor-daily-stats";
import type { HttpDailyAggregate } from "~/app/services/analytics";

import { createTestDatabase } from "~/app/lib/test/db";
import { monitorDailyStats } from "~/database/schema";

let getHttpDailyAggregateMock = vi.fn(async (): Promise<Result<HttpDailyAggregate[], Error>> =>
	success([]),
);

vi.doMock("~/app/services/analytics", () => ({
	getHttpDailyAggregate: getHttpDailyAggregateMock,
}));

/**
 * Monitor ids whose write must fail, so the "one bad row doesn't cost the rest their
 * stats" guarantee can be exercised. `MonitorDailyStats` is subclassed rather than
 * object-spread because class statics are non-enumerable, and every method other than
 * `upsertDay` has to keep working.
 */
let failingWrites = new Set<string>();
let realDailyStatsModule = await import("~/app/data/monitor-daily-stats");

class FakeMonitorDailyStats extends realDailyStatsModule.default {
	static override async upsertDay(db: Database, input: DailyStatsInput) {
		if (failingWrites.has(input.monitor_id)) throw new Error(`write failed: ${input.monitor_id}`);
		/**
		 * `super`, not `realDailyStatsModule.default`: the module's `default` binding is live,
		 * so once the mock below is installed that name resolves back to this class.
		 */
		return await super.upsertDay(db, input);
	}
}

vi.doMock("~/app/data/monitor-daily-stats", () => ({
	...realDailyStatsModule,
	default: FakeMonitorDailyStats,
}));

let { AggregateDailyStatsJob } = await import("./aggregate-daily-stats");

function makeJob() {
	return new AggregateDailyStatsJob({ logger: new BatchedLogger("test") }, {});
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	let job = makeJob();
	await container.scope(() => job.perform());
	return job;
}

/**
 * Patches `db.exec` on this one instance to return canned rows keyed by the raw SQL
 * statement's `FROM <table>` clause, standing in for the D1 aggregation queries
 * `aggregateD1`/`aggregateCron` run — see the file header for why the real in-memory
 * adapter can't answer them.
 */
function stubRawAggregateExec(db: Database, rowsByTable: Record<string, unknown[]>): void {
	/**
	 * `db.exec` is also the dispatch point the query builder uses internally for
	 * `findMany`/`create`/`delete` (any non-string, non-`SqlStatement` argument), so only
	 * raw SQL-string calls are intercepted here; everything else falls through to the
	 * real implementation, or `MonitorDailyStats.upsertDay`'s own reads/writes would break.
	 */
	let original = (db.exec as (...args: unknown[]) => Promise<unknown>).bind(db);
	(db as unknown as { exec: unknown }).exec = vi.fn(
		async (statement: unknown, values?: unknown[]) => {
			if (typeof statement !== "string") return original(statement, values);
			let table = /from\s+(\w+)/i.exec(statement)?.[1];
			let rows = (table && rowsByTable[table]) || [];
			return { rows, affectedRows: rows.length, insertId: undefined };
		},
	);
}

beforeEach(() => {
	getHttpDailyAggregateMock.mockReset();
	getHttpDailyAggregateMock.mockImplementation(async () => success([]));
	failingWrites.clear();
});

describe("AggregateDailyStatsJob", () => {
	test("aggregates HTTP totals from the analytics engine, rounding response times", async () => {
		let { db } = createTestDatabase();
		getHttpDailyAggregateMock.mockImplementation(async () =>
			success([
				{
					monitorId: "http-1",
					totalChecks: 10,
					successfulChecks: 8,
					avgResponseTimeMs: 120.4,
					maxResponseTimeMs: 340.9,
				},
			]),
		);

		let job = await runJob(db);

		let rows = await db.findMany(monitorDailyStats, {
			where: { monitor_id: "http-1", monitor_type: "http" },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.total_checks).toBe(10);
		expect(rows[0]!.successful_checks).toBe(8);
		expect(rows[0]!.failed_checks).toBe(2);
		expect(rows[0]!.avg_response_time_ms).toBe(120);
		expect(rows[0]!.max_response_time_ms).toBe(341);
		expect(rows[0]!.status).toBe("degraded");

		let completed = job.logger.events.find(
			(event) => event.event === "job.aggregate_daily_stats.completed",
		);
		expect(completed?.written).toBe(1);
	});

	test("skips HTTP aggregation and writes nothing when the analytics query fails", async () => {
		let { db } = createTestDatabase();
		getHttpDailyAggregateMock.mockImplementation(async () => failure(new Error("query failed")));

		let job = await runJob(db);

		let rows = await db.findMany(monitorDailyStats, { where: { monitor_type: "http" } });
		expect(rows).toHaveLength(0);

		let failedEvent = job.logger.events.find(
			(event) => event.event === "job.aggregate_daily_stats.http_failed",
		);
		expect(failedEvent?.error).toBe("query failed");
	});

	test("aggregates DNS results, classifying a monitor's day by success ratio and rounding response times", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, {
			dns_monitor_results: [
				{
					monitorId: "dns-1",
					totalChecks: 3,
					successfulChecks: 2,
					avgResponseTimeMs: 150.6,
					maxResponseTimeMs: 200.2,
				},
			],
		});

		await runJob(db);

		let rows = await db.findMany(monitorDailyStats, {
			where: { monitor_id: "dns-1", monitor_type: "dns" },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.total_checks).toBe(3);
		expect(rows[0]!.successful_checks).toBe(2);
		expect(rows[0]!.failed_checks).toBe(1);
		expect(rows[0]!.avg_response_time_ms).toBe(151);
		expect(rows[0]!.max_response_time_ms).toBe(200);
		expect(rows[0]!.status).toBe("degraded");
	});

	test("aggregates TCP results, treating 'up' as the healthy status", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, {
			tcp_monitor_results: [
				{
					monitorId: "tcp-1",
					totalChecks: 2,
					successfulChecks: 1,
					avgResponseTimeMs: null,
					maxResponseTimeMs: null,
				},
			],
		});

		await runJob(db);

		let rows = await db.findMany(monitorDailyStats, {
			where: { monitor_id: "tcp-1", monitor_type: "tcp" },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.total_checks).toBe(2);
		expect(rows[0]!.successful_checks).toBe(1);
		expect(rows[0]!.status).toBe("degraded");
		expect(rows[0]!.avg_response_time_ms).toBeNull();
	});

	test("aggregates cron pings using was_on_time, with no response-time columns", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, {
			cron_job_pings: [{ monitorId: "cron-1", totalChecks: 2, successfulChecks: 1 }],
		});

		await runJob(db);

		let rows = await db.findMany(monitorDailyStats, {
			where: { monitor_id: "cron-1", monitor_type: "cron" },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.total_checks).toBe(2);
		expect(rows[0]!.successful_checks).toBe(1);
		expect(rows[0]!.failed_checks).toBe(1);
		expect(rows[0]!.avg_response_time_ms).toBeNull();
		expect(rows[0]!.max_response_time_ms).toBeNull();
	});

	test("one monitor's failed write is logged and skipped, and doesn't cost the rest their stats", async () => {
		let { db } = createTestDatabase();
		failingWrites.add("http-2");
		getHttpDailyAggregateMock.mockImplementation(async () =>
			success(
				["http-1", "http-2", "http-3"].map((monitorId) => ({
					monitorId,
					totalChecks: 10,
					successfulChecks: 10,
					avgResponseTimeMs: 100,
					maxResponseTimeMs: 100,
				})),
			),
		);

		let job = await runJob(db);

		let written = await db.findMany(monitorDailyStats, { where: { monitor_type: "http" } });
		expect(written.map((row) => row.monitor_id).sort()).toEqual(["http-1", "http-3"]);

		let completed = job.logger.events.find(
			(event) => event.event === "job.aggregate_daily_stats.completed",
		);
		expect(completed?.written).toBe(2);

		let failedEvent = job.logger.events.find(
			(event) => event.event === "job.aggregate_daily_stats.write_failed",
		);
		expect(failedEvent?.monitorId).toBe("http-2");
	});

	test("re-running the job replaces the day's row instead of duplicating it", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, {
			dns_monitor_results: [
				{
					monitorId: "dns-1",
					totalChecks: 1,
					successfulChecks: 1,
					avgResponseTimeMs: 10,
					maxResponseTimeMs: 10,
				},
			],
		});

		await runJob(db);
		await runJob(db);

		let rows = await db.findMany(monitorDailyStats, {
			where: { monitor_id: "dns-1", monitor_type: "dns" },
		});
		expect(rows).toHaveLength(1);
	});
});

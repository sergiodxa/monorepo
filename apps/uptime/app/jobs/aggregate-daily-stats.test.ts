/**
 * Unit tests for the `aggregateDailyStats` job, covering its aggregation sources
 * (HTTP via Analytics Engine, DNS/TCP/flow via D1 result tables, cron via
 * `cron_job_pings`) and `MonitorDailyStats.upsertDay`'s replace-on-rerun idempotency.
 * `getHttpDailyAggregate` is mocked since Analytics Engine access has its own
 * service-level tests; the D1 and cron tests patch `db.exec` directly because the shared
 * in-memory adapter can't answer raw SQL reads. That stub answers by table name and not by
 * running the SQL, so the flow query's own filtering is asserted against the statement it
 * sends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { createJobContext } from "@pkg/jobs-next";
import { BatchedLogger } from "@pkg/logger";
import { failure, success } from "@pkg/result";
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
 * Monitor ids whose write must fail, exercising the "one bad row doesn't cost the
 * rest their stats" guarantee. Subclassing (not object-spreading) preserves every
 * other static method, since class statics are non-enumerable and would be lost.
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

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let aggregateDailyStats = (await import("./aggregate-daily-stats")).default;

/** Runs the handler over a context carrying the test's database, as the chain would. */
async function runJob(db: Database) {
	let ctx = createJobContext(jobs.aggregateDailyStats, {
		id: "message-1",
		attempts: 1,
		logger: new BatchedLogger("test"),
	});
	ctx.set(JobDatabase, db, { property: "database" });

	await aggregateDailyStats(ctx);
	return ctx;
}

/**
 * Patches `db.exec` on this one instance to return canned rows keyed by the raw SQL
 * statement's `FROM <table>` clause, standing in for the D1 aggregation queries the
 * job runs, since the in-memory adapter can't return rows for raw SQL reads.
 */
function stubRawAggregateExec(db: Database, rowsByTable: Record<string, unknown[]>): void {
	statements.length = 0;

	/**
	 * `db.exec` also dispatches the query builder's internal `findMany`/`create`/`delete`
	 * calls, so only raw SQL-string calls are intercepted here; other calls fall through
	 * to the real implementation, keeping `MonitorDailyStats.upsertDay`'s reads and writes intact.
	 */
	let original = (db.exec as (...args: unknown[]) => Promise<unknown>).bind(db);
	(db as unknown as { exec: unknown }).exec = vi.fn(
		async (statement: unknown, values?: unknown[]) => {
			if (typeof statement !== "string") return original(statement, values);
			statements.push({ sql: statement, values: values ?? [] });
			let table = /from\s+(\w+)/i.exec(statement)?.[1];
			let rows = (table && rowsByTable[table]) || [];
			return { rows, affectedRows: rows.length, insertId: undefined };
		},
	);
}

/** Every raw SQL read the stub answered, so a query's own `WHERE` can be asserted. */
let statements: Array<{ sql: string; values: unknown[] }> = [];

/** The aggregation query the job ran against one result table. */
function statementFor(table: string) {
	return statements.find((statement) => statement.sql.includes(table));
}

beforeEach(() => {
	getHttpDailyAggregateMock.mockReset();
	getHttpDailyAggregateMock.mockImplementation(async () => success([]));
	failingWrites.clear();
});

describe("aggregateDailyStats", () => {
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

	test("aggregates flow runs, taking the run's wall clock as the latency column", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, {
			flow_monitor_results: [
				{
					monitorId: "flow-1",
					totalChecks: 4,
					successfulChecks: 3,
					avgResponseTimeMs: 1840.5,
					maxResponseTimeMs: 2200,
				},
			],
		});

		await runJob(db);

		let rows = await db.findMany(monitorDailyStats, {
			where: { monitor_id: "flow-1", monitor_type: "flow" },
		});
		expect(rows).toHaveLength(1);
		expect(rows[0]!.total_checks).toBe(4);
		expect(rows[0]!.successful_checks).toBe(3);
		expect(rows[0]!.failed_checks).toBe(1);
		expect(rows[0]!.avg_response_time_ms).toBe(1841);
		expect(rows[0]!.max_response_time_ms).toBe(2200);
		expect(rows[0]!.status).toBe("degraded");

		let statement = statementFor("flow_monitor_results");
		expect(statement?.sql).toContain("AVG(duration_ms)");
		expect(statement?.sql).toContain("MAX(duration_ms)");
	});

	/**
	 * The same split the detail page's pass rate draws: an `error` run is this app failing to
	 * find out, so it belongs to neither half of the day and the two surfaces cannot disagree.
	 */
	test("leaves a flow's error runs out of the day, on both sides of the rate", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, { flow_monitor_results: [] });

		await runJob(db);

		let statement = statementFor("flow_monitor_results");
		expect(statement?.sql).toContain("status <> ?");
		expect(statement?.values).toContain("error");
	});

	/** Only flows have runs that never happened, so no other table's query filters any out. */
	test("counts every DNS and TCP result, however the check turned out", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, { dns_monitor_results: [], tcp_monitor_results: [] });

		await runJob(db);

		expect(statementFor("dns_monitor_results")?.sql).not.toContain("status <> ?");
		expect(statementFor("tcp_monitor_results")?.sql).not.toContain("status <> ?");
	});

	/**
	 * A day of nothing but errors groups to no rows at all, and the gap that leaves in the bar
	 * is the honest report: writing a zero-check row would classify the day as an outage.
	 */
	test("writes no row for a flow whose whole day was inconclusive", async () => {
		let { db } = createTestDatabase();
		stubRawAggregateExec(db, { flow_monitor_results: [] });

		await runJob(db);

		expect(await db.findMany(monitorDailyStats, { where: { monitor_type: "flow" } })).toHaveLength(
			0,
		);
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

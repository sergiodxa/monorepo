/**
 * Unit tests for `CheckTcpJob.perform()`, covering the sweep-every-enabled-monitor
 * loop: result recording via `TcpMonitor.recordCheckResult`, forwarding the monitor's
 * previous `last_status` into `notifyTcpResult` for edge-triggered alerting, and that
 * one monitor's check failure doesn't stop the rest of the sweep. `checkTcpConnection`
 * and `notifyTcpResult` are mocked — raw TCP connectivity (which needs
 * `cloudflare:sockets`, unavailable under `bun test`) and alert delivery have their own
 * tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import type { TcpCheckResult, TcpCheckStatus } from "~/app/services/tcp-check";
import type { InsertTcpMonitor } from "~/database/schema";

import TcpMonitor from "~/app/data/tcp-monitor";
import { createTestDatabase } from "~/app/lib/test/db";

let checkTcpConnectionMock = mock(
	async (_host: string, _port: number, _timeoutMs: number): Promise<TcpCheckResult> => ({
		status: "up",
		responseTimeMs: 10,
	}),
);

interface NotifyCall {
	monitorId: string;
	previousStatus: TcpCheckStatus | null;
	result: TcpCheckResult;
}

let notifyTcpResultCalls: NotifyCall[] = [];
let notifyTcpResultMock = mock(
	async (
		_db: unknown,
		_resend: unknown,
		monitor: { id: string },
		previousStatus: TcpCheckStatus | null,
		result: TcpCheckResult,
	) => {
		notifyTcpResultCalls.push({ monitorId: monitor.id, previousStatus, result });
	},
);

let realTcpCheckModule = await import("~/app/services/tcp-check");
let realAlertsModule = await import("~/app/services/alerts");

mock.module("~/app/services/tcp-check", () => ({
	...realTcpCheckModule,
	checkTcpConnection: checkTcpConnectionMock,
}));
/**
 * Every `notify*`/other export is spread from the real module here (not just
 * `notifyTcpResult` replaced) because `check-dns.test.ts`, `check-cron-jobs.test.ts`,
 * and `check-ssl.test.ts` mock this same module path — `bun test` shares one module
 * registry across files in a run, so a mock missing an export another file needs
 * (either "export not found", or silently getting a no-op stub instead of the real
 * implementation another file is trying to test) leaks into whichever file runs next.
 */
mock.module("~/app/services/alerts", () => ({
	...realAlertsModule,
	notifyTcpResult: notifyTcpResultMock,
}));

let { CheckTcpJob } = await import("./check-tcp");

function makeJob() {
	return new CheckTcpJob({ logger: new BatchedLogger("test") }, {});
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Resend, () => new Resend("re_test_key"));
	let job = makeJob();
	await container.scope(() => job.perform());
	return job;
}

async function seedMonitor(db: Database, overrides: Partial<InsertTcpMonitor> = {}) {
	return await TcpMonitor.create(db, "team-1", {
		name: "Example host",
		host: "example.com",
		port: 443,
		timeout_ms: 5000,
		is_enabled: true,
		...overrides,
	});
}

beforeEach(() => {
	checkTcpConnectionMock.mockReset();
	checkTcpConnectionMock.mockImplementation(async () => ({ status: "up", responseTimeMs: 10 }));
	notifyTcpResultMock.mockClear();
	notifyTcpResultCalls = [];
});

describe("CheckTcpJob", () => {
	test("checks an enabled monitor, records the result, and notifies with no previous status", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		checkTcpConnectionMock.mockImplementation(async () => ({
			status: "down",
			responseTimeMs: null,
		}));

		let job = await runJob(db);

		let updated = await TcpMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.last_status).toBe("down");
		expect(updated?.last_response_time_ms).toBeNull();
		expect(updated?.last_checked_at).not.toBeNull();

		let results = await TcpMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]!.status).toBe("down");

		expect(notifyTcpResultCalls).toHaveLength(1);
		expect(notifyTcpResultCalls[0]!.monitorId).toBe(monitor.id);
		expect(notifyTcpResultCalls[0]!.previousStatus).toBeNull();

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
	});

	test("skips monitors with checking disabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });

		await runJob(db);

		expect(checkTcpConnectionMock).not.toHaveBeenCalled();
		expect(notifyTcpResultCalls).toHaveLength(0);
	});

	test("forwards the monitor's previous last_status for edge-triggered alerting", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "timeout", last_response_time_ms: null });

		await runJob(db);

		expect(notifyTcpResultCalls[0]!.monitorId).toBe(monitor.id);
		expect(notifyTcpResultCalls[0]!.previousStatus).toBe("timeout");
	});

	test("continues checking remaining monitors and counts an error when one check throws", async () => {
		let { db } = createTestDatabase();
		let failing = await seedMonitor(db, { host: "fails.example.com" });
		let healthy = await seedMonitor(db, { host: "ok.example.com" });

		checkTcpConnectionMock.mockImplementation(async (host: string) => {
			if (host === "fails.example.com") throw new Error("Connection refused");
			return { status: "up", responseTimeMs: 10 };
		});

		let job = await runJob(db);

		expect(notifyTcpResultCalls.map((call) => call.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		/** The failing monitor's cached fields are untouched — recordCheckResult never ran for it. */
		let failedRow = await TcpMonitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.last_status).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_tcp.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

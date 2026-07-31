/**
 * Unit tests for `CheckTcpJob.perform()`, covering the claim-the-due-monitors pass: which
 * monitors a run picks up (only those their own `interval_seconds` has made due, and each of
 * them once however often the cron is delivered), result recording via
 * `TcpMonitor.recordCheckResult`, the `notify` message it enqueues
 * for an alert-worthy transition (carrying the monitor's pre-update `last_status` so the
 * consumer can tell a recovery from a first-ever result), that a healthy monitor enqueues
 * nothing, and that one monitor's check failure doesn't stop the rest of the sweep.
 *
 * `checkTcpConnection` is mocked — raw TCP connectivity needs `cloudflare:sockets`, which
 * is unavailable under `bun test` — and the `QUEUE` binding is faked so the enqueued
 * messages can be asserted on. Alert delivery itself now happens in `NotifyJob` and has
 * its own tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { TcpCheckResult } from "~/app/services/tcp-check";
import type { InsertTcpMonitor } from "~/database/schema";

import TcpMonitor from "~/app/data/tcp-monitor";
import { createTestDatabase } from "~/app/lib/test/db";
import { tcpMonitors } from "~/database/schema";

let checkTcpConnectionMock = mock(
	async (_host: string, _port: number, _timeoutMs: number): Promise<TcpCheckResult> => ({
		status: "up",
		responseTimeMs: 10,
	}),
);

/** Every `notify` message body the sweep put on the queue, in order. */
let enqueued: NotifyMessage[] = [];
let sendBatchMock = mock(async (requests: Array<{ body: NotifyMessage }>) => {
	for (let request of requests) enqueued.push(request.body);
});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { sendBatch: sendBatchMock, send: async () => {} } },
}));
mock.module("~/app/services/tcp-check", () => ({
	checkTcpConnection: checkTcpConnectionMock,
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
	sendBatchMock.mockClear();
	enqueued = [];
});

describe("CheckTcpJob", () => {
	test("checks an enabled monitor, records the result, and enqueues a notification with no previous status", async () => {
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

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "down",
			},
		]);

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
		expect(completed?.notified).toBe(1);
	});

	test("skips monitors with checking disabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });

		await runJob(db);

		expect(checkTcpConnectionMock).not.toHaveBeenCalled();
		expect(enqueued).toHaveLength(0);
	});

	test("skips a monitor whose configured interval hasn't come round yet", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { interval_seconds: 3600 });
		await db.update(
			tcpMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 30 * 60_000 },
			{ touch: false },
		);

		await runJob(db);

		expect(checkTcpConnectionMock).not.toHaveBeenCalled();
	});

	test("checks a monitor once however many times the minute's cron is delivered", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { interval_seconds: 3600 });

		await runJob(db);
		await runJob(db);

		expect(checkTcpConnectionMock).toHaveBeenCalledTimes(1);
	});

	test("records a still-up monitor without enqueuing a notification", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "up", last_response_time_ms: 10 });

		let job = await runJob(db);

		let results = await TcpMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(sendBatchMock).not.toHaveBeenCalled();

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.notified).toBe(0);
	});

	test("carries the monitor's pre-update last_status so the consumer can detect a recovery", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "timeout", last_response_time_ms: null });

		await runJob(db);

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: "timeout",
				newStatus: "up",
			},
		]);
	});

	test("continues checking remaining monitors and counts an error when one check throws", async () => {
		let { db } = createTestDatabase();
		let failing = await seedMonitor(db, { host: "fails.example.com", last_status: "up" });
		let healthy = await seedMonitor(db, { host: "ok.example.com", last_status: "down" });

		checkTcpConnectionMock.mockImplementation(async (host: string) => {
			if (host === "fails.example.com") throw new Error("Connection refused");
			return { status: "up", responseTimeMs: 10 };
		});

		let job = await runJob(db);

		expect(enqueued.map((message) => message.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		/** The failing monitor's cached fields are untouched — recordCheckResult never ran for it. */
		let failedRow = await TcpMonitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.last_status).toBe("up");
		expect(failedRow?.last_checked_at).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_tcp.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

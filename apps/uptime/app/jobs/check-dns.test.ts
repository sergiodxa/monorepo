/**
 * Unit tests for `CheckDnsJob.perform()`, covering the claim-the-due-monitors pass: which
 * monitors a run picks up (only those their own `interval_seconds` has made due, and each of
 * them once however often the cron is delivered), result recording via
 * `DnsMonitor.recordCheckResult`, the `notify` message it enqueues
 * for an alert-worthy transition (carrying the monitor's pre-update `last_status` so the
 * consumer can tell a recovery from a first-ever result), that a still-ok monitor enqueues
 * nothing, and that one monitor's check failure doesn't stop the rest of the sweep.
 *
 * `checkDns` is mocked — DNS resolution has its own tests — and the `QUEUE` binding is
 * faked so the enqueued messages can be asserted on. Alert delivery itself now happens in
 * `NotifyJob`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { DnsCheckResult } from "~/app/services/dns-check";
import type { InsertDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitors } from "~/database/schema";

let checkDnsMock = mock(
	async (
		_domain: string,
		_recordType: string,
		_expectedValue: string | null,
		_previousValue: string | null,
	): Promise<DnsCheckResult> => ({ status: "ok", resolvedValue: "1.2.3.4", responseTimeMs: 10 }),
);

/** Every `notify` message body the sweep put on the queue, in order. */
let enqueued: NotifyMessage[] = [];
let sendBatchMock = mock(async (requests: Array<{ body: NotifyMessage }>) => {
	for (let request of requests) enqueued.push(request.body);
});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { sendBatch: sendBatchMock, send: async () => {} } },
}));

let realDnsCheckModule = await import("~/app/services/dns-check");

mock.module("~/app/services/dns-check", () => ({ ...realDnsCheckModule, checkDns: checkDnsMock }));

let { CheckDnsJob } = await import("./check-dns");

function makeJob() {
	return new CheckDnsJob({ logger: new BatchedLogger("test") }, {});
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);
	let job = makeJob();
	await container.scope(() => job.perform());
	return job;
}

async function seedMonitor(db: Database, overrides: Partial<InsertDnsMonitor> = {}) {
	return await DnsMonitor.create(db, "team-1", {
		name: "Example domain",
		domain: "example.com",
		record_type: "A",
		expected_value: null,
		is_enabled: true,
		...overrides,
	});
}

beforeEach(() => {
	checkDnsMock.mockReset();
	checkDnsMock.mockImplementation(async () => ({
		status: "ok",
		resolvedValue: "1.2.3.4",
		responseTimeMs: 10,
	}));
	sendBatchMock.mockClear();
	enqueued = [];
});

describe("CheckDnsJob", () => {
	test("checks an enabled monitor, records the result, and enqueues a notification with no previous status", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		checkDnsMock.mockImplementation(async () => ({
			status: "changed",
			resolvedValue: "5.6.7.8",
			responseTimeMs: 42,
		}));

		let job = await runJob(db);

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.last_status).toBe("changed");
		expect(updated?.last_value).toBe("5.6.7.8");
		expect(updated?.last_checked_at).not.toBeNull();

		let results = await DnsMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]!.status).toBe("changed");
		expect(results[0]!.response_time_ms).toBe(42);

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "dns",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "changed",
			},
		]);

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
		expect(completed?.notified).toBe(1);
	});

	test("skips monitors with checking disabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });

		await runJob(db);

		expect(checkDnsMock).not.toHaveBeenCalled();
		expect(enqueued).toHaveLength(0);
	});

	test("skips a monitor whose configured interval hasn't come round yet", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { interval_seconds: 3600 });
		await db.update(
			dnsMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 30 * 60_000 },
			{ touch: false },
		);

		await runJob(db);

		expect(checkDnsMock).not.toHaveBeenCalled();
	});

	test("checks a monitor once however many times the minute's cron is delivered", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { interval_seconds: 3600 });

		await runJob(db);
		await runJob(db);

		expect(checkDnsMock).toHaveBeenCalledTimes(1);
	});

	test("records a still-ok monitor without enqueuing a notification", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "ok", last_value: "1.2.3.4" });

		let job = await runJob(db);

		let results = await DnsMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(sendBatchMock).not.toHaveBeenCalled();

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.notified).toBe(0);
	});

	test("carries the monitor's pre-update last_status so the consumer can detect a recovery", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "changed", last_value: "9.9.9.9" });

		await runJob(db);

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "dns",
				monitorId: monitor.id,
				previousStatus: "changed",
				newStatus: "ok",
			},
		]);
	});

	test("continues checking remaining monitors and counts an error when one check throws", async () => {
		let { db } = createTestDatabase();
		let failing = await seedMonitor(db, { domain: "fails.example.com" });
		let healthy = await seedMonitor(db, { domain: "ok.example.com", last_status: "error" });

		checkDnsMock.mockImplementation(async (domain: string) => {
			if (domain === "fails.example.com") throw new Error("DNS query failed");
			return { status: "ok", resolvedValue: "1.2.3.4", responseTimeMs: 10 };
		});

		let job = await runJob(db);

		expect(enqueued.map((message) => message.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		/** The failing monitor's cached fields are untouched — recordCheckResult never ran for it. */
		let failedRow = await DnsMonitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.last_status).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_dns.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

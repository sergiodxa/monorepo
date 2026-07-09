/**
 * Unit tests for `CheckDnsJob.perform()`, covering the sweep-every-enabled-monitor
 * loop: result recording via `DnsMonitor.recordCheckResult`, forwarding the monitor's
 * previous `last_status` into `notifyDnsResult` for edge-triggered alerting, and that
 * one monitor's check failure doesn't stop the rest of the sweep. `checkDns` and
 * `notifyDnsResult` are mocked — DNS resolution and alert delivery have their own tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import type { DnsCheckResult, DnsCheckStatus } from "~/app/services/dns-check";
import type { InsertDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import { createTestDatabase } from "~/app/lib/test/db";

let checkDnsMock = mock(
	async (
		_domain: string,
		_recordType: string,
		_expectedValue: string | null,
		_previousValue: string | null,
	): Promise<DnsCheckResult> => ({ status: "ok", resolvedValue: "1.2.3.4", responseTimeMs: 10 }),
);

interface NotifyCall {
	monitorId: string;
	previousStatus: DnsCheckStatus | null;
	result: DnsCheckResult;
}

let notifyDnsResultCalls: NotifyCall[] = [];
let notifyDnsResultMock = mock(
	async (
		_db: unknown,
		_resend: unknown,
		monitor: { id: string },
		previousStatus: DnsCheckStatus | null,
		result: DnsCheckResult,
	) => {
		notifyDnsResultCalls.push({ monitorId: monitor.id, previousStatus, result });
	},
);

mock.module("~/app/services/dns-check", () => ({ checkDns: checkDnsMock }));
// All four `notify*` exports are stubbed here (not just `notifyDnsResult`) because
// `check-tcp.test.ts`, `check-cron-jobs.test.ts`, and `check-ssl.test.ts` mock this same
// module path — `bun test` shares one module registry across files in a run, so a mock
// missing an export another file's job imports fails with "export not found".
mock.module("~/app/services/alerts", () => ({
	notifyDnsResult: notifyDnsResultMock,
	notifyTcpResult: mock(async () => {}),
	notifyCronJobResult: mock(async () => {}),
	notifySslResult: mock(async () => {}),
}));

let { CheckDnsJob } = await import("./check-dns");

function makeJob() {
	return new CheckDnsJob({ logger: new BatchedLogger("test") }, {});
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Resend, () => new Resend("re_test_key"));
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
	notifyDnsResultMock.mockClear();
	notifyDnsResultCalls = [];
});

describe("CheckDnsJob", () => {
	test("checks an enabled monitor, records the result, and notifies with no previous status", async () => {
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

		expect(notifyDnsResultCalls).toHaveLength(1);
		expect(notifyDnsResultCalls[0]!.monitorId).toBe(monitor.id);
		expect(notifyDnsResultCalls[0]!.previousStatus).toBeNull();

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
	});

	test("skips monitors with checking disabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });

		await runJob(db);

		expect(checkDnsMock).not.toHaveBeenCalled();
		expect(notifyDnsResultCalls).toHaveLength(0);
	});

	test("forwards the monitor's previous last_status for edge-triggered alerting", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "changed", last_value: "9.9.9.9" });

		await runJob(db);

		expect(notifyDnsResultCalls[0]!.monitorId).toBe(monitor.id);
		expect(notifyDnsResultCalls[0]!.previousStatus).toBe("changed");
	});

	test("continues checking remaining monitors and counts an error when one check throws", async () => {
		let { db } = createTestDatabase();
		let failing = await seedMonitor(db, { domain: "fails.example.com" });
		let healthy = await seedMonitor(db, { domain: "ok.example.com" });

		checkDnsMock.mockImplementation(async (domain: string) => {
			if (domain === "fails.example.com") throw new Error("DNS query failed");
			return { status: "ok", resolvedValue: "1.2.3.4", responseTimeMs: 10 };
		});

		let job = await runJob(db);

		expect(notifyDnsResultCalls.map((call) => call.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		// The failing monitor's cached fields are untouched — recordCheckResult never ran for it.
		let failedRow = await DnsMonitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.last_status).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_dns.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

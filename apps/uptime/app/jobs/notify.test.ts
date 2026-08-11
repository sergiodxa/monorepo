/**
 * Unit tests for `NotifyJob.perform()`, the consumer that dispatches the alerts for one
 * monitor status transition off the sweep that detected it: that each monitor type routes
 * to its own `notify*` helper with the message's statuses and a snapshot rebuilt from the
 * monitor row, that a monitor deleted between the sweep and this job is acknowledged rather
 * than retried, and how malformed messages versus failed lookups map onto
 * non-retriable/retriable outcomes.
 *
 * The `notify*` helpers are mocked — the alert pipeline they run has its own tests — so
 * these tests are about the routing, the reloaded row, and the retry decisions.
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

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import TcpMonitor from "~/app/data/tcp-monitor";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";

interface NotifyCall {
	helper: "tcp" | "dns" | "cron" | "ssl";
	monitorId: string;
	monitorName: string;
	previousStatus: unknown;
	payload: unknown;
}

let notifyCalls: NotifyCall[] = [];

function recordCall(helper: NotifyCall["helper"]) {
	return async (
		_db: unknown,
		_mailer: unknown,
		monitor: { id: string; name: string },
		previousStatus: unknown,
		payload: unknown,
	) => {
		notifyCalls.push({
			helper,
			monitorId: monitor.id,
			monitorName: monitor.name,
			previousStatus,
			payload,
		});
	};
}

let notifyTcpResultMock = mock(recordCall("tcp"));
let notifyDnsResultMock = mock(recordCall("dns"));
let notifyCronJobResultMock = mock(recordCall("cron"));
let notifySslResultMock = mock(recordCall("ssl"));

/**
 * `~/app/data/monitor` reads `env` from `cloudflare:workers` at module load, and the
 * repo-root preload's placeholder bindings are only strings, so the module is stubbed here
 * for runs from this package's own directory too.
 */
mock.module("cloudflare:workers", () => ({
	env: new Proxy({} as Record<string, unknown>, { get: (_target, prop: string) => `test-${prop}` }),
}));

let realAlertsModule = await import("~/app/services/alerts");

mock.module("~/app/services/alerts", () => ({
	...realAlertsModule,
	notifyTcpResult: notifyTcpResultMock,
	notifyDnsResult: notifyDnsResultMock,
	notifyCronJobResult: notifyCronJobResultMock,
	notifySslResult: notifySslResultMock,
}));

let { Job } = await import("@pkg/jobs");
let { NotifyJob } = await import("./notify");
let { default: Monitor } = await import("~/app/data/monitor");

/**
 * The message bodies these tests hand the job. Deliberately loose — the point of several
 * cases is a body the job must reject — so it isn't `NotifyMessage`.
 */
type MessageBody = {
	type: string;
	monitorType: string;
	monitorId: string;
	previousStatus?: string | null;
	newStatus?: string;
};

async function runJob(db: Database, body: MessageBody) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);
	let job = new NotifyJob({ logger: new BatchedLogger("test") }, body);
	await container.scope(() => job.perform());
	return job;
}

beforeEach(() => {
	/** Implementations are reinstated, not just cleared, since a test may replace one. */
	notifyTcpResultMock.mockReset();
	notifyTcpResultMock.mockImplementation(recordCall("tcp"));
	notifyDnsResultMock.mockReset();
	notifyDnsResultMock.mockImplementation(recordCall("dns"));
	notifyCronJobResultMock.mockReset();
	notifyCronJobResultMock.mockImplementation(recordCall("cron"));
	notifySslResultMock.mockReset();
	notifySslResultMock.mockImplementation(recordCall("ssl"));
	notifyCalls = [];
});

describe("NotifyJob", () => {
	test("dispatches a TCP transition with a result rebuilt from the monitor row", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, "team-1", {
			name: "Example host",
			host: "example.com",
			port: 443,
			timeout_ms: 5000,
			is_enabled: true,
			last_status: "down",
			last_response_time_ms: 1234,
		});

		let job = await runJob(db, {
			type: "notify",
			monitorType: "tcp",
			monitorId: monitor.id,
			previousStatus: "up",
			newStatus: "down",
		});

		expect(notifyCalls).toEqual([
			{
				helper: "tcp",
				monitorId: monitor.id,
				monitorName: "Example host",
				previousStatus: "up",
				payload: { status: "down", responseTimeMs: 1234 },
			},
		]);

		let completed = job.logger.events.find((event) => event.event === "job.notify.completed");
		expect(completed?.monitorType).toBe("tcp");
		expect(completed?.newStatus).toBe("down");
	});

	/**
	 * The message carries two statuses and no findings, so the body of the email it
	 * produces exists only if this job reloads the records the sweep wrote. A transition
	 * with a headline and no detail is the failure this covers.
	 */
	test("dispatches a DNS transition with the findings reloaded from the record table", async () => {
		let { db } = createTestDatabase();
		let monitor = await DnsMonitor.create(db, "team-1", {
			name: "Example domain",
			domain: "example.com",
			is_enabled: true,
			last_status: "changed",
		});

		await DnsMonitorRecord.importMany(db, monitor.id, [
			{
				name: "example.com",
				record_type: "MX",
				value: "10 mx1.example.com",
				source: "resolver",
				is_enabled: true,
				status: "missing",
				last_seen_at: null,
			},
			{
				name: "example.com",
				record_type: "MX",
				value: "20 mx2.example.com",
				source: "resolver",
				is_enabled: false,
				status: "new",
				last_seen_at: Date.now(),
			},
			{
				name: "example.com",
				record_type: "A",
				value: "1.1.1.1",
				source: "resolver",
				is_enabled: true,
				status: "ok",
				last_seen_at: Date.now(),
			},
		]);

		await runJob(db, {
			type: "notify",
			monitorType: "dns",
			monitorId: monitor.id,
			previousStatus: null,
			newStatus: "changed",
		});

		expect(notifyCalls).toEqual([
			{
				helper: "dns",
				monitorId: monitor.id,
				monitorName: "Example domain",
				previousStatus: null,
				payload: {
					status: "changed",
					recordsMissing: 1,
					recordsChanged: 0,
					recordsNew: 1,
					findings: [
						{ kind: "missing", name: "example.com", recordType: "MX", value: "10 mx1.example.com" },
						{ kind: "new", name: "example.com", recordType: "MX", value: "20 mx2.example.com" },
					],
				},
			},
		]);
	});

	test("dispatches a cron-job transition with both of its statuses", async () => {
		let { db } = createTestDatabase();
		let monitor = await CronJobMonitor.create(db, "team-1", {
			name: "Nightly backup",
			description: null,
			cron_expression: "0 0 * * *",
			grace_period_seconds: 300,
			timezone: "UTC",
			status: "missed",
			alert_on_late: false,
			last_ping_at: null,
			next_expected_at: Date.now(),
			enabled_at: Date.now(),
		});

		await runJob(db, {
			type: "notify",
			monitorType: "cron",
			monitorId: monitor.id,
			previousStatus: "late",
			newStatus: "missed",
		});

		expect(notifyCalls).toEqual([
			{
				helper: "cron",
				monitorId: monitor.id,
				monitorName: "Nightly backup",
				previousStatus: "late",
				payload: "missed",
			},
		]);
	});

	test("dispatches an SSL transition with days-until-expiry recomputed from the row", async () => {
		let { db } = createTestDatabase();
		let monitor = await Monitor.create(db, "team-1", "author-1", {
			name: "Example site",
			url: "https://example.com",
			ssl_monitoring_enabled: true,
			ssl_expiry_warning_days: 30,
			ssl_expires_at: Date.now() + 5 * 24 * 60 * 60 * 1000 + 60_000,
		});

		await runJob(db, {
			type: "notify",
			monitorType: "ssl",
			monitorId: monitor.id,
			previousStatus: "valid",
			newStatus: "expiring",
		});

		expect(notifyCalls).toHaveLength(1);
		expect(notifyCalls[0]!.helper).toBe("ssl");
		expect(notifyCalls[0]!.monitorId).toBe(monitor.id);
		/** `notifySslResult` takes the status where the other helpers take a result object. */
		expect(notifyCalls[0]!.previousStatus).toBe("expiring");
		expect(notifyCalls[0]!.payload).toBe(5);
	});

	test("acknowledges a monitor that no longer exists", async () => {
		let { db } = createTestDatabase();

		let job = await runJob(db, {
			type: "notify",
			monitorType: "tcp",
			monitorId: "deleted-monitor",
			previousStatus: "up",
			newStatus: "down",
		});

		expect(notifyCalls).toHaveLength(0);
		let event = job.logger.events.find((event) => event.event === "job.notify.monitor_not_found");
		expect(event?.monitorId).toBe("deleted-monitor");
	});

	test("never retries a message whose shape is invalid", async () => {
		let { db } = createTestDatabase();

		await expect(
			runJob(db, { type: "notify", monitorType: "carrier-pigeon", monitorId: "monitor-1" }),
		).rejects.toBeInstanceOf(Job.NonRetriableError);
	});

	test("never retries a status the monitor type doesn't have", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, "team-1", {
			name: "Example host",
			host: "example.com",
			port: 443,
			timeout_ms: 5000,
			is_enabled: true,
		});

		await expect(
			runJob(db, {
				type: "notify",
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "changed",
			}),
		).rejects.toBeInstanceOf(Job.NonRetriableError);
	});

	test("retries when the alert lookup itself fails", async () => {
		let { db } = createTestDatabase();
		let monitor = await TcpMonitor.create(db, "team-1", {
			name: "Example host",
			host: "example.com",
			port: 443,
			timeout_ms: 5000,
			is_enabled: true,
		});

		notifyTcpResultMock.mockImplementation(async () => {
			throw new Error("D1 unavailable");
		});

		await expect(
			runJob(db, {
				type: "notify",
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "down",
			}),
		).rejects.toBeInstanceOf(Job.RetryError);
	});
});

/**
 * Unit tests for the `notify` job: that each monitor type routes to its own
 * `notify*` helper with a snapshot reloaded from the monitor row, that a monitor deleted
 * between the sweep and this job is acknowledged rather than retried, and how malformed
 * messages versus failed lookups map onto non-retriable/retriable outcomes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotifyInput } from "~/app/jobs";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import FlowMonitor from "~/app/data/flow-monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";

interface NotifyCall {
	helper: "tcp" | "dns" | "cron" | "flow" | "ssl";
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

let notifyTcpResultMock = vi.fn(recordCall("tcp"));
let notifyDnsResultMock = vi.fn(recordCall("dns"));
let notifyCronJobResultMock = vi.fn(recordCall("cron"));
let notifyFlowResultMock = vi.fn(recordCall("flow"));
let notifySslResultMock = vi.fn(recordCall("ssl"));

/**
 * `~/app/data/monitor` imports `env` from `cloudflare:workers` at module load, and this
 * package's preload only supplies placeholder strings, so it's stubbed here too. Nothing
 * on this file's routing path reaches a binding, so none is supplied.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let realAlertsModule = await import("~/app/services/alerts");

vi.doMock("~/app/services/alerts", () => ({
	...realAlertsModule,
	notifyTcpResult: notifyTcpResultMock,
	notifyDnsResult: notifyDnsResultMock,
	notifyCronJobResult: notifyCronJobResultMock,
	notifyFlowResult: notifyFlowResultMock,
	notifySslResult: notifySslResultMock,
}));

let { Job, createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let notify = (await import("./notify")).default;
let { default: Monitor } = await import("~/app/data/monitor");

/**
 * The wide event the run under test emitted. It lives out here because a run that asks for
 * a redelivery leaves the handler throwing, and the record it emitted on the way out is
 * exactly what that case is about.
 */
let record: Record<string, unknown> = {};

/** Runs the handler over a context carrying the test's database, as the chain would. */
async function runJob(db: Database, input: NotifyInput) {
	let container = new ServiceContainer();
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);

	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.notify, { id: "message-1", attempts: 1, input, log });
	ctx.set(JobDatabase, db, { property: "database" });

	try {
		await container.scope(() => notify(ctx));
	} finally {
		log.emit();
	}
}

/** One breadcrumb the run left, for the assertions that read a note's own fields. */
function noteOf(name: string): Log.Note | undefined {
	return (record.notes as Log.Note[] | undefined)?.find((note) => note.name === name);
}

beforeEach(() => {
	record = {};
	/** Implementations are reinstated, not just cleared, since a test may replace one. */
	notifyTcpResultMock.mockReset();
	notifyTcpResultMock.mockImplementation(recordCall("tcp"));
	notifyDnsResultMock.mockReset();
	notifyDnsResultMock.mockImplementation(recordCall("dns"));
	notifyCronJobResultMock.mockReset();
	notifyCronJobResultMock.mockImplementation(recordCall("cron"));
	notifyFlowResultMock.mockReset();
	notifyFlowResultMock.mockImplementation(recordCall("flow"));
	notifySslResultMock.mockReset();
	notifySslResultMock.mockImplementation(recordCall("ssl"));
	notifyCalls = [];
});

describe("notify", () => {
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

		await runJob(db, {
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

		expect(record).toMatchObject({
			"monitor.id": monitor.id,
			"monitor.type": "tcp",
			"notification.previous_status": "up",
			"notification.status": "down",
		});
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

	/**
	 * The message carries two statuses and no failure, so the assertion the email quotes
	 * exists only if this job reloads the result row the sweep wrote.
	 */
	test("dispatches a flow transition with the failing assertion reloaded from the result row", async () => {
		let { db } = createTestDatabase();
		let monitor = await FlowMonitor.create(db, "team-1", {
			name: "Checkout",
			source: 'test "checkout" { }',
			is_enabled: true,
		});

		await FlowMonitor.recordCheckResult(db, monitor.id, {
			status: "down",
			testsTotal: 4,
			testsPassed: 2,
			testsFailed: 1,
			requestsMade: 3,
			failedTest: "checkout accepts the coupon",
			failedAtLine: 27,
			failureDetail: "expected status 200, got 500",
			durationMs: 1840,
			errorMessage: null,
		});

		await runJob(db, {
			monitorType: "flow",
			monitorId: monitor.id,
			previousStatus: "up",
			newStatus: "down",
		});

		expect(notifyCalls).toEqual([
			{
				helper: "flow",
				monitorId: monitor.id,
				monitorName: "Checkout",
				previousStatus: "up",
				payload: {
					status: "down",
					testsTotal: 4,
					testsPassed: 2,
					testsFailed: 1,
					failedTest: "checkout accepts the coupon",
					failedAtLine: 27,
					failureDetail: "expected status 200, got 500",
					durationMs: 1840,
				},
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

		await runJob(db, {
			monitorType: "tcp",
			monitorId: "deleted-monitor",
			previousStatus: "up",
			newStatus: "down",
		});

		expect(notifyCalls).toHaveLength(0);
		expect(noteOf("monitors.not_found")).toBeDefined();
		expect(record).toMatchObject({ "monitor.id": "deleted-monitor" });
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
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "changed",
			}),
		).rejects.toBeInstanceOf(Job.NonRetriable);
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
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "down",
			}),
		).rejects.toBeInstanceOf(Job.Retry);

		expect(record).toMatchObject({ outcome: "error", "error.message": "D1 unavailable" });
	});
});

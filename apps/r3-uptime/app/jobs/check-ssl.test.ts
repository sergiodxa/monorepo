/**
 * Unit tests for `CheckSslJob.perform()`, covering the sweep-every-SSL-enabled-monitor
 * loop: persisting `calculateSslStatus`'s result onto the monitor row, passing each
 * monitor's own expiry settings into the calculation, and that one monitor's failure
 * doesn't stop the rest of the sweep. `calculateSslStatus` and `notifySslResult` are
 * mocked so each test controls the exact status/expiry outcome instead of depending on
 * wall-clock arithmetic — status classification and alert delivery have their own
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

import type { SslStatus } from "~/app/services/ssl-info";
import type { InsertMonitor } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";

interface CalculateCall {
	expiresAt: number | null;
	warningDays: number;
}

let calculateCalls: CalculateCall[] = [];
let calculateSslStatusMock = mock(
	(
		expiresAt: number | null,
		warningDays: number,
	): { status: SslStatus; daysUntilExpiry: number | null } => {
		calculateCalls.push({ expiresAt, warningDays });
		return { status: "valid", daysUntilExpiry: 100 };
	},
);

interface NotifyCall {
	monitorId: string;
	status: SslStatus;
	daysUntilExpiry: number | null;
}

let notifySslResultCalls: NotifyCall[] = [];
let notifySslResultMock = mock(
	async (
		_db: unknown,
		_resend: unknown,
		monitor: { id: string },
		status: SslStatus,
		daysUntilExpiry: number | null,
	) => {
		notifySslResultCalls.push({ monitorId: monitor.id, status, daysUntilExpiry });
	},
);

// `~/app/data/monitor` (imported transitively by `./check-ssl`) reads `env` from
// `cloudflare:workers` at module load. The repo-root `bunfig.toml` preload stubs this
// automatically for `bun test` run from the repo root, but not when run from this
// package's own directory (as instructed), so it's stubbed explicitly here too.
mock.module("cloudflare:workers", () => ({
	env: new Proxy({} as Record<string, unknown>, { get: (_target, prop: string) => `test-${prop}` }),
}));

mock.module("~/app/services/ssl-info", () => ({ calculateSslStatus: calculateSslStatusMock }));
// All four `notify*` exports are stubbed here (not just `notifySslResult`) because
// `check-dns.test.ts`, `check-tcp.test.ts`, and `check-cron-jobs.test.ts` mock this same
// module path — `bun test` shares one module registry across files in a run, so a mock
// missing an export another file's job imports fails with "export not found".
mock.module("~/app/services/alerts", () => ({
	notifySslResult: notifySslResultMock,
	notifyDnsResult: mock(async () => {}),
	notifyTcpResult: mock(async () => {}),
	notifyCronJobResult: mock(async () => {}),
}));

let { CheckSslJob } = await import("./check-ssl");
// Imported dynamically, after the `cloudflare:workers` mock above, since `Monitor`
// itself reads `env` at module load and a static import would be hoisted before it.
let { default: Monitor } = await import("~/app/data/monitor");

function makeJob() {
	return new CheckSslJob({ logger: new BatchedLogger("test") }, {});
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Resend, () => new Resend("re_test_key"));
	let job = makeJob();
	await container.scope(() => job.perform());
	return job;
}

async function seedMonitor(db: Database, overrides: Partial<InsertMonitor> = {}) {
	return await Monitor.create(db, "team-1", "author-1", {
		name: "Example site",
		url: "https://example.com",
		ssl_monitoring_enabled: true,
		ssl_expiry_warning_days: 30,
		ssl_expires_at: Date.now() + 10 * 24 * 60 * 60 * 1000,
		...overrides,
	});
}

beforeEach(() => {
	calculateSslStatusMock.mockReset();
	calculateSslStatusMock.mockImplementation((expiresAt, warningDays) => {
		calculateCalls.push({ expiresAt, warningDays });
		return { status: "valid", daysUntilExpiry: 100 };
	});
	calculateCalls = [];
	notifySslResultMock.mockClear();
	notifySslResultCalls = [];
});

describe("CheckSslJob", () => {
	test("re-evaluates SSL status and persists it onto the monitor row", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		calculateSslStatusMock.mockImplementation(() => ({ status: "expiring", daysUntilExpiry: 5 }));

		let job = await runJob(db);

		let updated = await Monitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.ssl_status).toBe("expiring");
		expect(updated?.ssl_last_checked_at).not.toBeNull();

		expect(notifySslResultCalls).toHaveLength(1);
		expect(notifySslResultCalls[0]!.monitorId).toBe(monitor.id);
		expect(notifySslResultCalls[0]!.status).toBe("expiring");
		expect(notifySslResultCalls[0]!.daysUntilExpiry).toBe(5);

		let completed = job.logger.events.find((event) => event.event === "job.check_ssl.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
	});

	test("skips monitors without SSL monitoring enabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { ssl_monitoring_enabled: false });

		await runJob(db);

		expect(calculateSslStatusMock).not.toHaveBeenCalled();
		expect(notifySslResultCalls).toHaveLength(0);
	});

	test("passes each monitor's own expiry settings into calculateSslStatus", async () => {
		let { db } = createTestDatabase();
		let expiresAtA = Date.now() + 5 * 24 * 60 * 60 * 1000;
		let expiresAtB = Date.now() + 90 * 24 * 60 * 60 * 1000;
		await seedMonitor(db, {
			url: "https://a.example.com",
			ssl_expires_at: expiresAtA,
			ssl_expiry_warning_days: 7,
		});
		await seedMonitor(db, {
			url: "https://b.example.com",
			ssl_expires_at: expiresAtB,
			ssl_expiry_warning_days: 60,
		});

		await runJob(db);

		expect(calculateCalls).toHaveLength(2);
		expect(calculateCalls).toContainEqual({ expiresAt: expiresAtA, warningDays: 7 });
		expect(calculateCalls).toContainEqual({ expiresAt: expiresAtB, warningDays: 60 });
	});

	test("continues checking remaining monitors and counts an error when calculateSslStatus throws", async () => {
		let { db } = createTestDatabase();
		// Distinct expiry timestamps so the mock below can tell the two monitors apart —
		// two `Date.now()`-based defaults could otherwise collide within the same millisecond.
		let failing = await seedMonitor(db, {
			url: "https://fails.example.com",
			ssl_expires_at: Date.now() + 1 * 24 * 60 * 60 * 1000,
		});
		let healthy = await seedMonitor(db, {
			url: "https://ok.example.com",
			ssl_expires_at: Date.now() + 2 * 24 * 60 * 60 * 1000,
		});

		calculateSslStatusMock.mockImplementation((expiresAt) => {
			if (expiresAt === failing.ssl_expires_at) throw new Error("Unexpected expiry value");
			return { status: "valid", daysUntilExpiry: 100 };
		});

		let job = await runJob(db);

		expect(notifySslResultCalls.map((call) => call.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_ssl.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		// The failing monitor's cached fields are untouched — updateById never ran for it.
		let failedRow = await Monitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.ssl_last_checked_at).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_ssl.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

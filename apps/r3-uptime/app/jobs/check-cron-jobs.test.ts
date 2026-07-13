/**
 * Unit tests for `CheckCronJobsJob.perform()`, covering the healthy → late → missed
 * status-transition sweep: the grace-period arithmetic that decides each transition,
 * which monitors `CronJobMonitor.listActionable` excludes from the sweep entirely, and
 * that `notifyCronJobResult` only fires on an actual transition. `notifyCronJobResult`
 * is mocked — alert delivery has its own tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import type { CronJobStatus, InsertCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import { createTestDatabase } from "~/app/lib/test/db";

interface NotifyCall {
	monitorId: string;
	previousStatus: CronJobStatus;
	newStatus: CronJobStatus;
}

let notifyCronJobResultCalls: NotifyCall[] = [];
let notifyCronJobResultMock = mock(
	async (
		_db: unknown,
		_resend: unknown,
		monitor: { id: string },
		previousStatus: CronJobStatus,
		newStatus: CronJobStatus,
	) => {
		notifyCronJobResultCalls.push({ monitorId: monitor.id, previousStatus, newStatus });
	},
);

/**
 * All four `notify*` exports are stubbed here (not just `notifyCronJobResult`) because
 * `check-dns.test.ts`, `check-tcp.test.ts`, and `check-ssl.test.ts` mock this same
 * module path — `bun test` shares one module registry across files in a run, so a mock
 * missing an export another file's job imports fails with "export not found".
 */
mock.module("~/app/services/alerts", () => ({
	notifyCronJobResult: notifyCronJobResultMock,
	notifyDnsResult: mock(async () => {}),
	notifyTcpResult: mock(async () => {}),
	notifySslResult: mock(async () => {}),
}));

let { CheckCronJobsJob } = await import("./check-cron-jobs");

function makeJob() {
	return new CheckCronJobsJob({ logger: new BatchedLogger("test") }, {});
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Resend, () => new Resend("re_test_key"));
	let job = makeJob();
	await container.scope(() => job.perform());
	return job;
}

async function seedMonitor(db: Database, overrides: Partial<InsertCronJobMonitor> = {}) {
	let now = Date.now();
	return await CronJobMonitor.create(db, "team-1", {
		name: "Nightly backup",
		description: null,
		cron_expression: "0 0 * * *",
		grace_period_seconds: 300,
		timezone: "UTC",
		status: "healthy",
		alert_on_late: false,
		last_ping_at: null,
		next_expected_at: now - 1000,
		enabled_at: now,
		...overrides,
	});
}

beforeEach(() => {
	notifyCronJobResultMock.mockClear();
	notifyCronJobResultCalls = [];
});

describe("CheckCronJobsJob", () => {
	test("transitions a healthy monitor past its expected time, within grace, to late", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			next_expected_at: now - 1000,
			grace_period_seconds: 300,
		});

		let job = await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("late");

		expect(notifyCronJobResultCalls).toEqual([
			{ monitorId: monitor.id, previousStatus: "healthy", newStatus: "late" },
		]);

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.total).toBe(1);
		expect(completed?.transitioned).toBe(1);
	});

	test("transitions a healthy monitor whose grace period has also elapsed directly to missed", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			next_expected_at: now - 10 * 60 * 1000,
			grace_period_seconds: 300,
		});

		await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("missed");
		expect(notifyCronJobResultCalls).toEqual([
			{ monitorId: monitor.id, previousStatus: "healthy", newStatus: "missed" },
		]);
	});

	test("transitions a late monitor whose grace period elapses to missed", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "late",
			next_expected_at: now - 10 * 60 * 1000,
			grace_period_seconds: 300,
		});

		await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("missed");
		expect(notifyCronJobResultCalls).toEqual([
			{ monitorId: monitor.id, previousStatus: "late", newStatus: "missed" },
		]);
	});

	test("leaves a monitor whose expected time hasn't arrived yet untouched", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			next_expected_at: now + 60_000,
		});

		let job = await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("healthy");
		expect(notifyCronJobResultCalls).toHaveLength(0);

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.transitioned).toBe(0);
	});

	test("excludes an already-missed monitor from the sweep", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		await seedMonitor(db, {
			status: "missed",
			next_expected_at: now - 10 * 60 * 1000,
		});

		let job = await runJob(db);

		expect(notifyCronJobResultCalls).toHaveLength(0);
		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.total).toBe(0);
	});

	test("excludes a new monitor with no next_expected_at from the sweep", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { status: "new", next_expected_at: null, enabled_at: null });

		let job = await runJob(db);

		expect(notifyCronJobResultCalls).toHaveLength(0);
		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.total).toBe(0);
	});
});

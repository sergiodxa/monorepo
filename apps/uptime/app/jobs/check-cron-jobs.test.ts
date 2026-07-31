/**
 * Unit tests for `CheckCronJobsJob.perform()`, covering the healthy → late → missed
 * status-transition sweep: the grace-period arithmetic that decides each transition, which
 * monitors `CronJobMonitor.listActionable` excludes from the sweep entirely, and that a
 * `notify` message is enqueued only on an actual transition the monitor asked to hear about
 * — carrying the status the monitor held before `updateStatus` overwrote it, which is what
 * makes the transition classifiable downstream. A monitor with `alert_on_late` off still
 * transitions to `late`; it just never reaches the queue.
 *
 * The `QUEUE` binding is faked so the enqueued messages can be asserted on; alert delivery
 * itself now happens in `NotifyJob` and has its own tests.
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
import type { InsertCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import { createTestDatabase } from "~/app/lib/test/db";

/** Every `notify` message body the sweep put on the queue, in order. */
let enqueued: NotifyMessage[] = [];
let sendBatchMock = mock(async (requests: Array<{ body: NotifyMessage }>) => {
	for (let request of requests) enqueued.push(request.body);
});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { sendBatch: sendBatchMock, send: async () => {} } },
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
	sendBatchMock.mockClear();
	enqueued = [];
});

describe("CheckCronJobsJob", () => {
	test("transitions a healthy monitor past its expected time, within grace, to late", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			alert_on_late: true,
			next_expected_at: now - 1000,
			grace_period_seconds: 300,
		});

		let job = await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("late");

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "cron",
				monitorId: monitor.id,
				previousStatus: "healthy",
				newStatus: "late",
			},
		]);

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.total).toBe(1);
		expect(completed?.transitioned).toBe(1);
		expect(completed?.notified).toBe(1);
	});

	test("records the late transition but enqueues nothing when alert_on_late is off", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			alert_on_late: false,
			next_expected_at: now - 1000,
			grace_period_seconds: 300,
		});

		let job = await runJob(db);

		/**
		 * The status still moves — `missed` is reached from `late`, so suppressing the
		 * transition would break the timeline; only the notification is withheld.
		 */
		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("late");

		expect(enqueued).toHaveLength(0);
		expect(sendBatchMock).not.toHaveBeenCalled();

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.transitioned).toBe(1);
		expect(completed?.notified).toBe(0);
		expect(completed?.errorCount).toBe(0);
	});

	test("still enqueues the missed transition of a monitor with alert_on_late off", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "late",
			alert_on_late: false,
			next_expected_at: now - 10 * 60 * 1000,
			grace_period_seconds: 300,
		});

		await runJob(db);

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "cron",
				monitorId: monitor.id,
				previousStatus: "late",
				newStatus: "missed",
			},
		]);
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
		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "cron",
				monitorId: monitor.id,
				previousStatus: "healthy",
				newStatus: "missed",
			},
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
		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "cron",
				monitorId: monitor.id,
				previousStatus: "late",
				newStatus: "missed",
			},
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
		expect(sendBatchMock).not.toHaveBeenCalled();

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

		expect(enqueued).toHaveLength(0);
		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.total).toBe(0);
	});

	test("excludes a new monitor with no next_expected_at from the sweep", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { status: "new", next_expected_at: null, enabled_at: null });

		let job = await runJob(db);

		expect(enqueued).toHaveLength(0);
		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.total).toBe(0);
	});

	test("transitions every due monitor in one sweep", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let seeded = [];
		for (let index = 0; index < 25; index++) {
			seeded.push(
				await seedMonitor(db, {
					name: `Backup ${index}`,
					status: "healthy",
					next_expected_at: now - 10 * 60 * 1000,
					grace_period_seconds: 300,
				}),
			);
		}

		let job = await runJob(db);

		expect(enqueued.map((message) => message.monitorId).sort()).toEqual(
			seeded.map((monitor) => monitor.id).sort(),
		);

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_cron_jobs.completed",
		);
		expect(completed?.transitioned).toBe(25);
	});
});

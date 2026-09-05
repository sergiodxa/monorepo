/**
 * Unit tests for the `checkCronJobs` job, covering the healthy → late → missed
 * status-transition sweep: the grace-period arithmetic behind each transition, which
 * monitors `CronJobMonitor.listActionable` excludes entirely, and that a `notify` message
 * carries the status held before `updateStatus` overwrote it, which is what makes the
 * transition classifiable downstream.
 *
 * The `QUEUE` binding is an in-memory queue installed through `cloudflare:workers`, so the
 * assertions are about the messages that really landed on it; alert delivery itself now
 * happens in the `notify` job and has its own tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { InsertCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";

/**
 * The queue the sweep notifies through. It lives at module scope because the module
 * under test captures `env` on import; `beforeEach` empties it to reuse the same
 * instance across tests.
 */
let queue: QueueMock<NotifyMessage> = createQueue<NotifyMessage>({ name: "notify" });

/** Spying on `sendBatch` confirms the send path was actually invoked, beyond what `sent` alone shows. */
let sendBatch = vi.spyOn(queue, "sendBatch");

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let checkCronJobs = (await import("./check-cron-jobs")).default;

/** Every `notify` message body the sweep put on the queue, in order. */
function enqueued(): NotifyMessage[] {
	return queue.sent.map((message) => message.body);
}

/** Runs the handler over a context carrying the test's database, and returns its record. */
async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.checkCronJobs, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, db, { property: "database" });

	await container.scope(() => checkCronJobs(ctx));
	log.emit();
	return record;
}

/** One breadcrumb the run left, for the assertions that read a note's own fields. */
function noteOf(record: Record<string, unknown>, name: string): Log.Note | undefined {
	return (record.notes as Log.Note[] | undefined)?.find((note) => note.name === name);
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
	queue.reset();
	sendBatch.mockClear();
});

describe("checkCronJobs", () => {
	test("repairs an enabled monitor that has no expected-arrival time", async () => {
		/**
		 * The hole this closes: such a row used to be filtered out of the sweep entirely, so
		 * it never left `healthy` however long it went unpinged. Five production monitors
		 * reported green for ten days while nothing pinged them.
		 */
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { status: "healthy", next_expected_at: null });

		await runJob(db);

		let repaired = await CronJobMonitor.findById(db, monitor.id);
		expect(repaired?.next_expected_at).not.toBeNull();
		expect(repaired?.next_expected_at ?? 0).toBeGreaterThan(Date.now());
		/** Repair is not a health verdict, and there is nothing to be late for yet. */
		expect(repaired?.status).toBe("healthy");
		expect(enqueued()).toEqual([]);
	});

	test("goes late on the pass after a repair once the repaired deadline passes", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			alert_on_late: true,
			next_expected_at: null,
		});

		await runJob(db);
		let repaired = await CronJobMonitor.findById(db, monitor.id);

		/** Wind the repaired deadline into the past; the next sweep must now judge it. */
		await CronJobMonitor.setNextExpected(
			db,
			monitor.id,
			Date.now() - (repaired?.grace_period_seconds ?? 300) * 1000 - 1000,
		);
		await runJob(db);

		expect((await CronJobMonitor.findById(db, monitor.id))?.status).toBe("late");
	});

	test("leaves an enabled monitor alone when its schedule cannot be parsed", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			next_expected_at: null,
			cron_expression: "not a cron expression",
		});

		let record = await runJob(db);

		let untouched = await CronJobMonitor.findById(db, monitor.id);
		expect(untouched?.next_expected_at).toBeNull();
		expect(untouched?.status).toBe("healthy");
		expect(noteOf(record, "monitors.unschedulable")?.["monitor.id"]).toBe(monitor.id);
	});

	test("leaves a healthy monitor alone while it is still inside its grace period", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			alert_on_late: true,
			next_expected_at: now - 1000,
			grace_period_seconds: 300,
		});

		await runJob(db);

		let stillHealthy = await CronJobMonitor.findById(db, monitor.id);
		expect(stillHealthy?.status).toBe("healthy");
		expect(enqueued()).toEqual([]);
	});

	test("transitions a healthy monitor whose grace period has elapsed to late", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			alert_on_late: true,
			next_expected_at: now - 400 * 1000,
			grace_period_seconds: 300,
		});

		let record = await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("late");

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "cron",
				monitorId: monitor.id,
				previousStatus: "healthy",
				newStatus: "late",
			},
		]);

		expect(record).toMatchObject({
			"checks.total": 1,
			"checks.transitioned": 1,
			"checks.notified": 1,
		});
	});

	test("records the late transition but enqueues nothing when alert_on_late is off", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "healthy",
			alert_on_late: false,
			next_expected_at: now - 400 * 1000,
			grace_period_seconds: 300,
		});

		let record = await runJob(db);

		/**
		 * The status still moves — `missed` is reached from `late`, so suppressing the
		 * transition would break the timeline; only the notification is withheld.
		 */
		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("late");

		expect(enqueued()).toHaveLength(0);
		expect(sendBatch).not.toHaveBeenCalled();

		expect(record).toMatchObject({
			"checks.transitioned": 1,
			"checks.notified": 0,
			"checks.failed": 0,
		});
	});

	test("still enqueues the missed transition of a monitor with alert_on_late off", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		let monitor = await seedMonitor(db, {
			status: "late",
			alert_on_late: false,
			next_expected_at: now - (24 * 60 * 60 * 1000 + 600 * 1000),
			grace_period_seconds: 300,
		});

		await runJob(db);

		expect(enqueued()).toEqual([
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
			next_expected_at: now - (24 * 60 * 60 * 1000 + 600 * 1000),
			grace_period_seconds: 300,
		});

		await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("missed");
		expect(enqueued()).toEqual([
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
			next_expected_at: now - (24 * 60 * 60 * 1000 + 600 * 1000),
			grace_period_seconds: 300,
		});

		await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("missed");
		expect(enqueued()).toEqual([
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

		let record = await runJob(db);

		let updated = await CronJobMonitor.findById(db, monitor.id);
		expect(updated?.status).toBe("healthy");
		expect(sendBatch).not.toHaveBeenCalled();

		expect(record).toMatchObject({ "checks.transitioned": 0 });
	});

	test("excludes an already-missed monitor from the sweep", async () => {
		let { db } = createTestDatabase();
		let now = Date.now();
		await seedMonitor(db, {
			status: "missed",
			next_expected_at: now - 10 * 60 * 1000,
		});

		let record = await runJob(db);

		expect(enqueued()).toHaveLength(0);
		expect(record).toMatchObject({ "checks.total": 0 });
	});

	test("excludes a new monitor with no next_expected_at from the sweep", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { status: "new", next_expected_at: null, enabled_at: null });

		let record = await runJob(db);

		expect(enqueued()).toHaveLength(0);
		expect(record).toMatchObject({ "checks.total": 0 });
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
					/**
					 * Past the following daily occurrence, so each transitions to `missed` — the
					 * transition that notifies regardless of `alert_on_late`.
					 */
					next_expected_at: now - (24 * 60 * 60 * 1000 + 600 * 1000),
					grace_period_seconds: 300,
				}),
			);
		}

		let record = await runJob(db);

		expect(
			enqueued()
				.map((message) => message.monitorId)
				.sort(),
		).toEqual(seeded.map((monitor) => monitor.id).sort());

		expect(record).toMatchObject({ "checks.transitioned": 25 });
	});
});

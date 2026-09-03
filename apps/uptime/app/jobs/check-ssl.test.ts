/**
 * Unit tests for the `checkSsl` job: persisting `calculateSslStatus`'s
 * result onto the monitor row, passing each monitor's own expiry settings,
 * enqueuing a `notify` message only when a warning threshold is crossed, and
 * surviving one monitor's failure without stopping the rest of the sweep.
 * `calculateSslStatus` is mocked so each test controls the exact outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { createJobContext } from "@sdxc/jobs";
import { BatchedLogger } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { SslStatus } from "~/app/services/ssl-info";
import type { InsertMonitor } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";

interface CalculateCall {
	expiresAt: number | null;
	warningDays: number;
}

let calculateCalls: CalculateCall[] = [];
let calculateSslStatusMock = vi.fn(
	(
		expiresAt: number | null,
		warningDays: number,
	): { status: SslStatus; daysUntilExpiry: number | null } => {
		calculateCalls.push({ expiresAt, warningDays });
		return { status: "valid", daysUntilExpiry: 100 };
	},
);

/**
 * The queue the sweep notifies through, at module scope because the module
 * under test captures `env` on import, so `beforeEach` empties it rather than
 * re-creating it; the stubbed `env` module's placeholder bindings aren't callable.
 */
let queue: QueueMock<NotifyMessage> = createQueue<NotifyMessage>({ name: "notify" });

/** A sweep that enqueued nothing is a call that never happened, which `sent` cannot show. */
let sendBatch = vi.spyOn(queue, "sendBatch");

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({ QUEUE: queue }) }));

let realSslInfoModule = await import("~/app/services/ssl-info");

vi.doMock("~/app/services/ssl-info", () => ({
	...realSslInfoModule,
	calculateSslStatus: calculateSslStatusMock,
}));

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let checkSsl = (await import("./check-ssl")).default;
/**
 * Imported dynamically, after the `cloudflare:workers` mock above, since `Monitor`
 * itself reads `env` at module load and a static import would be hoisted before it.
 */
let { default: Monitor } = await import("~/app/data/monitor");

/** Every `notify` message body the sweep put on the queue, in order. */
function enqueued(): NotifyMessage[] {
	return queue.sent.map((message) => message.body);
}

/** Runs the handler over a context carrying the test's database, as the chain would. */
async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);

	let ctx = createJobContext(jobs.checkSsl, {
		id: "message-1",
		attempts: 1,
		logger: new BatchedLogger("test"),
	});
	ctx.set(JobDatabase, db, { property: "database" });

	await container.scope(() => checkSsl(ctx));
	return ctx;
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
	queue.reset();
	sendBatch.mockClear();
});

describe("checkSsl", () => {
	test("re-evaluates SSL status, persists it, and enqueues a notification for an expiring certificate", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		calculateSslStatusMock.mockImplementation(() => ({ status: "expiring", daysUntilExpiry: 5 }));

		let job = await runJob(db);

		let updated = await Monitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.ssl_status).toBe("expiring");
		expect(updated?.ssl_last_checked_at).not.toBeNull();

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "ssl",
				monitorId: monitor.id,
				previousStatus: "unknown",
				newStatus: "expiring",
			},
		]);

		let completed = job.logger.events.find((event) => event.event === "job.check_ssl.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
		expect(completed?.notified).toBe(1);
	});

	test("skips monitors without SSL monitoring enabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { ssl_monitoring_enabled: false });

		await runJob(db);

		expect(calculateSslStatusMock).not.toHaveBeenCalled();
		expect(enqueued()).toHaveLength(0);
	});

	test("persists a valid certificate's status without enqueuing a notification", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		await runJob(db);

		let updated = await Monitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.ssl_status).toBe("valid");
		expect(sendBatch).not.toHaveBeenCalled();
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
		/**
		 * Distinct expiry timestamps so the mock below can tell the two monitors apart —
		 * two `Date.now()`-based defaults could otherwise collide within the same millisecond.
		 */
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
			return { status: "expired", daysUntilExpiry: -1 };
		});

		let job = await runJob(db);

		expect(enqueued().map((message) => message.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_ssl.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		/** The failing monitor's cached fields are untouched — updateById never ran for it. */
		let failedRow = await Monitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.ssl_last_checked_at).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_ssl.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

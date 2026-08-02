/**
 * Unit tests for `CleanJob.perform`: verifies each of the four result tables is swept
 * with its own retention window and its own date column, that recent rows and — per the
 * module doc — rows whose date column is still `NULL` are left alone, and that the
 * completion log carries both the total and the per-table breakdown the first large run
 * is observed through.
 *
 * The free-watch pass has its own suite, because the thing worth testing there is not a
 * window per table but the order the three sweeps run in: a watch survives its week of
 * checking, a lead survives as long as one of its watches does, and both fall over
 * together once the last conversion window has closed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import { CleanJob } from "~/app/jobs/clean";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	alertEvents,
	dnsMonitorResults,
	leads,
	monitorResults,
	tcpMonitorResults,
	trialWatchResults,
	trialWatches,
} from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("CleanJob.perform", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];
	let container: ServiceContainer;

	beforeEach(() => {
		({ db } = createTestDatabase());
		container = new ServiceContainer();
		container.singleton(Database, () => db);
	});

	function seedResult(id: string, completedAt: number | null) {
		let now = Date.now();
		return db.create(monitorResults, {
			id,
			created_at: now,
			updated_at: now,
			completed_at: completedAt,
			monitor_id: "monitor-1",
			response_status: 200,
			response_time_ms: 42,
		});
	}

	function seedDnsResult(id: string, checkedAt: number) {
		return db.create(dnsMonitorResults, {
			id,
			dns_monitor_id: "dns-monitor-1",
			status: "ok",
			resolved_value: "203.0.113.1",
			response_time_ms: 12,
			error_message: null,
			checked_at: checkedAt,
		});
	}

	function seedTcpResult(id: string, checkedAt: number) {
		return db.create(tcpMonitorResults, {
			id,
			tcp_monitor_id: "tcp-monitor-1",
			status: "up",
			response_time_ms: 12,
			error_message: null,
			checked_at: checkedAt,
		});
	}

	function seedAlertEvent(id: string, sentAt: number) {
		return db.create(alertEvents, {
			id,
			created_at: sentAt,
			sent_at: sentAt,
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "Example",
			snapshot: null,
		});
	}

	async function run(logger = new BatchedLogger("test")) {
		await container.scope(async () => {
			let job = new CleanJob({ logger }, {});
			await job.perform();
		});

		return logger;
	}

	test("deletes results completed more than 7 days ago and keeps recent ones", async () => {
		let now = Date.now();
		await seedResult("result-old", now - 10 * MS_PER_DAY);
		await seedResult("result-recent", now - 1 * MS_PER_DAY);

		await run();

		let remaining = await db.findMany(monitorResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["result-recent"]);
	});

	test("never deletes a row whose completed_at is still null", async () => {
		await seedResult("result-pending", null);

		await run();

		let remaining = await db.findMany(monitorResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["result-pending"]);
	});

	test("deletes dns results checked more than 90 days ago, keyed on checked_at", async () => {
		let now = Date.now();
		await seedDnsResult("dns-old", now - 91 * MS_PER_DAY);
		await seedDnsResult("dns-inside-window", now - 89 * MS_PER_DAY);

		await run();

		let remaining = await db.findMany(dnsMonitorResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["dns-inside-window"]);
	});

	test("deletes tcp results checked more than 90 days ago, keyed on checked_at", async () => {
		let now = Date.now();
		await seedTcpResult("tcp-old", now - 91 * MS_PER_DAY);
		await seedTcpResult("tcp-inside-window", now - 89 * MS_PER_DAY);

		await run();

		let remaining = await db.findMany(tcpMonitorResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["tcp-inside-window"]);
	});

	test("deletes alert events sent more than 90 days ago, keyed on sent_at", async () => {
		let now = Date.now();
		await seedAlertEvent("event-old", now - 91 * MS_PER_DAY);
		await seedAlertEvent("event-inside-window", now - 89 * MS_PER_DAY);

		await run();

		let remaining = await db.findMany(alertEvents, {});
		expect(remaining.map((row) => row.id)).toEqual(["event-inside-window"]);
	});

	test("keeps DNS and TCP history that the 7-day HTTP window would have deleted", async () => {
		let now = Date.now();
		await seedDnsResult("dns-month-old", now - 30 * MS_PER_DAY);
		await seedTcpResult("tcp-month-old", now - 30 * MS_PER_DAY);
		await seedAlertEvent("event-month-old", now - 30 * MS_PER_DAY);

		await run();

		expect(await db.findMany(dnsMonitorResults, {})).toHaveLength(1);
		expect(await db.findMany(tcpMonitorResults, {})).toHaveLength(1);
		expect(await db.findMany(alertEvents, {})).toHaveLength(1);
	});

	test("logs the number of rows deleted", async () => {
		let now = Date.now();
		await seedResult("result-old", now - 10 * MS_PER_DAY);

		let logger = await run();

		let event = logger.events.find((entry) => entry.event === "job.clean.completed");
		expect(event).toBeDefined();
		expect(event?.rowsDeleted).toBe(1);
	});

	test("logs a per-table breakdown and whether a sweep hit its ceiling", async () => {
		let now = Date.now();
		await seedResult("result-old", now - 10 * MS_PER_DAY);
		await seedDnsResult("dns-old", now - 91 * MS_PER_DAY);
		await seedTcpResult("tcp-old", now - 91 * MS_PER_DAY);
		await seedAlertEvent("event-old", now - 91 * MS_PER_DAY);

		let logger = await run();

		let event = logger.events.find((entry) => entry.event === "job.clean.completed");
		expect(event?.rowsDeleted).toBe(4);
		expect(event?.reachedCeiling).toBe(false);
		expect(event?.tables).toEqual([
			{ table: "monitor_results", rowsDeleted: 1, batches: 1, reachedCeiling: false },
			{ table: "dns_monitor_results", rowsDeleted: 1, batches: 1, reachedCeiling: false },
			{ table: "tcp_monitor_results", rowsDeleted: 1, batches: 1, reachedCeiling: false },
			{ table: "alert_events", rowsDeleted: 1, batches: 1, reachedCeiling: false },
			{ table: "trial_watch_results", rowsDeleted: 0, batches: 1, reachedCeiling: false },
			{ table: "trial_watches", rowsDeleted: 0, batches: 1, reachedCeiling: false },
			{ table: "leads", rowsDeleted: 0, batches: 1, reachedCeiling: false },
		]);
	});

	test("reports every table even when there is nothing to delete", async () => {
		let logger = await run();

		let event = logger.events.find((entry) => entry.event === "job.clean.completed");
		expect(event?.rowsDeleted).toBe(0);
		expect(event?.tables).toHaveLength(7);
	});
});

/**
 * The free-watch pass. Its three sweeps are a sequence, not three independent windows, so
 * these cases are about what each one is allowed to remove given what ran before it.
 */
describe("CleanJob.perform trial cleanup", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];
	let container: ServiceContainer;

	beforeEach(() => {
		({ db } = createTestDatabase());
		container = new ServiceContainer();
		container.singleton(Database, () => db);
	});

	async function run() {
		await container.scope(async () => {
			await new CleanJob({ logger: new BatchedLogger("test") }, {}).perform();
		});
	}

	async function seedLead(id: string, createdAt: number) {
		return await db.create(leads, {
			id,
			created_at: createdAt,
			updated_at: createdAt,
			email: `${id}@example.com`,
			unsubscribe_token: `token-${id}`,
			locale: "en",
			consented_at: null,
			last_digest_at: null,
		});
	}

	/** A watch dated from `createdAt`, with both of its deadlines derived the way it is created. */
	async function seedWatch(id: string, leadId: string, createdAt: number) {
		return await db.create(trialWatches, {
			id,
			created_at: createdAt,
			updated_at: createdAt,
			lead_id: leadId,
			url: "https://example.com",
			next_due_at: null,
			expires_at: createdAt + 7 * MS_PER_DAY,
			converts_until: createdAt + 30 * MS_PER_DAY,
		});
	}

	async function seedTrialResult(id: string, watchId: string, checkedAt: number) {
		return await db.create(trialWatchResults, {
			id,
			trial_watch_id: watchId,
			status: "up",
			response_time_ms: 42,
			checked_at: checkedAt,
		});
	}

	test("deletes trial results older than the seven days a watch writes them over", async () => {
		let now = Date.now();
		await seedTrialResult("old", "watch-1", now - 8 * MS_PER_DAY);
		await seedTrialResult("recent", "watch-1", now - 6 * MS_PER_DAY);

		await run();

		let remaining = await db.findMany(trialWatchResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["recent"]);
	});

	test("keeps a watch whose week of checking is over but whose offer is still open", async () => {
		let now = Date.now();
		await seedLead("lead-1", now - 10 * MS_PER_DAY);
		await seedWatch("watch-1", "lead-1", now - 10 * MS_PER_DAY);

		await run();

		// Ten days old: past `expires_at`, nowhere near `converts_until`.
		expect(await db.findMany(trialWatches, {})).toHaveLength(1);
		expect(await db.findMany(leads, {})).toHaveLength(1);
	});

	test("deletes a watch once its conversion window has closed", async () => {
		let now = Date.now();
		await seedLead("lead-1", now - 31 * MS_PER_DAY);
		await seedWatch("watch-1", "lead-1", now - 31 * MS_PER_DAY);

		await run();

		expect(await db.findMany(trialWatches, {})).toHaveLength(0);
	});

	test("deletes the lead in the same run its last watch goes, and not before", async () => {
		let now = Date.now();
		await seedLead("lead-1", now - 31 * MS_PER_DAY);
		await seedWatch("expired", "lead-1", now - 31 * MS_PER_DAY);

		await run();

		// Watches are swept before leads, so "no watches left" is already true by the time the
		// lead sweep asks.
		expect(await db.findMany(leads, {})).toHaveLength(0);
	});

	test("keeps a lead while any one of its attempts is still convertible", async () => {
		let now = Date.now();
		await seedLead("lead-1", now - 31 * MS_PER_DAY);
		await seedWatch("expired", "lead-1", now - 31 * MS_PER_DAY);
		await seedWatch("still-open", "lead-1", now - 20 * MS_PER_DAY);

		await run();

		expect((await db.findMany(trialWatches, {})).map((row) => row.id)).toEqual(["still-open"]);
		expect(await db.findMany(leads, {})).toHaveLength(1);
	});

	test("leaves a lead created moments ago alone, so it cannot race its first watch", async () => {
		await seedLead("lead-1", Date.now());

		await run();

		expect(await db.findMany(leads, {})).toHaveLength(1);
	});

	test("takes an orphaned lead even when they gave marketing consent", async () => {
		let now = Date.now();
		await seedLead("lead-1", now - 31 * MS_PER_DAY);
		await db.update(leads, "lead-1", { consented_at: now - 31 * MS_PER_DAY }, { touch: false });

		await run();

		// Consent is not an exemption while every email this feature sends is driven by a
		// watch: with the last watch gone there is nothing left for the consent to authorise.
		expect(await db.findMany(leads, {})).toHaveLength(0);
	});
});

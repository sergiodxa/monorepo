/**
 * Unit tests for `CleanJob.perform`: verifies each of the four result tables is swept
 * with its own retention window and its own date column, that recent rows and — per the
 * module doc — rows whose date column is still `NULL` are left alone, and that the
 * completion log carries both the total and the per-table breakdown the first large run
 * is observed through.
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
	monitorResults,
	tcpMonitorResults,
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
		]);
	});

	test("reports every table even when there is nothing to delete", async () => {
		let logger = await run();

		let event = logger.events.find((entry) => entry.event === "job.clean.completed");
		expect(event?.rowsDeleted).toBe(0);
		expect(event?.tables).toHaveLength(4);
	});
});

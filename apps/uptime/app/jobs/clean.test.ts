/**
 * Unit tests for `CleanJob.perform`: verifies the retention cutoff deletes old
 * `monitor_results` rows, leaves recent ones alone, and — per the module doc — never
 * touches rows with a `completed_at IS NULL` cache row, since `completed_at < ?` never
 * matches `NULL` in SQL.
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
import { monitorResults } from "~/database/schema";

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

	test("deletes results completed more than 7 days ago and keeps recent ones", async () => {
		let now = Date.now();
		await seedResult("result-old", now - 10 * MS_PER_DAY);
		await seedResult("result-recent", now - 1 * MS_PER_DAY);

		await container.scope(async () => {
			let job = new CleanJob({ logger: new BatchedLogger("test") }, {});
			await job.perform();
		});

		let remaining = await db.findMany(monitorResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["result-recent"]);
	});

	test("never deletes a row whose completed_at is still null", async () => {
		await seedResult("result-pending", null);

		await container.scope(async () => {
			let job = new CleanJob({ logger: new BatchedLogger("test") }, {});
			await job.perform();
		});

		let remaining = await db.findMany(monitorResults, {});
		expect(remaining.map((row) => row.id)).toEqual(["result-pending"]);
	});

	test("logs the number of rows deleted", async () => {
		let now = Date.now();
		await seedResult("result-old", now - 10 * MS_PER_DAY);

		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new CleanJob({ logger }, {});
			await job.perform();
		});

		let event = logger.events.find((entry) => entry.event === "job.clean.completed");
		expect(event).toBeDefined();
		expect(event?.rowsDeleted).toBe(1);
	});
});

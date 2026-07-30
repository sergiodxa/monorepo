/**
 * Unit tests for `CleanCronJobPingsJob.perform`: verifies it deletes `cron_job_pings`
 * rows older than `PING_RETENTION_DAYS` and leaves everything else untouched, against
 * a real in-memory database.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import { PING_RETENTION_DAYS } from "~/app/data/cron-job";
import { CleanCronJobPingsJob } from "~/app/jobs/clean-cron-job-pings";
import { createTestDatabase } from "~/app/lib/test/db";
import { cronJobPings } from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("CleanCronJobPingsJob.perform", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];
	let container: ServiceContainer;

	beforeEach(() => {
		({ db } = createTestDatabase());
		container = new ServiceContainer();
		container.singleton(Database, () => db);
	});

	function seedPing(id: string, createdAt: number) {
		return db.create(cronJobPings, {
			id,
			created_at: createdAt,
			cron_job_monitor_id: "monitor-1",
			was_on_time: true,
			source_ip: null,
			user_agent: null,
		});
	}

	test("deletes pings older than the retention window and keeps the rest", async () => {
		let now = Date.now();
		let old = now - (PING_RETENTION_DAYS + 1) * MS_PER_DAY;
		let recent = now - 10 * MS_PER_DAY;

		await seedPing("ping-old", old);
		await seedPing("ping-recent", recent);

		await container.scope(async () => {
			let job = new CleanCronJobPingsJob({ logger: new BatchedLogger("test") }, {});
			await job.perform();
		});

		let remaining = await db.findMany(cronJobPings, {});
		expect(remaining.map((row) => row.id)).toEqual(["ping-recent"]);
	});

	test("does nothing when every ping is within the retention window", async () => {
		let now = Date.now();
		await seedPing("ping-recent-1", now - 1 * MS_PER_DAY);
		await seedPing("ping-recent-2", now - 2 * MS_PER_DAY);

		await container.scope(async () => {
			let job = new CleanCronJobPingsJob({ logger: new BatchedLogger("test") }, {});
			await job.perform();
		});

		let remaining = await db.findMany(cronJobPings, {});
		expect(remaining).toHaveLength(2);
	});

	test("logs the number of rows deleted", async () => {
		let now = Date.now();
		await seedPing("ping-old", now - (PING_RETENTION_DAYS + 1) * MS_PER_DAY);

		let logger = new BatchedLogger("test");

		await container.scope(async () => {
			let job = new CleanCronJobPingsJob({ logger }, {});
			await job.perform();
		});

		let event = logger.events.find((entry) => entry.event === "job.clean_cron_job_pings.completed");
		expect(event).toBeDefined();
		expect(event?.rowsDeleted).toBe(1);
	});
});

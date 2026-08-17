/**
 * Unit tests for `CleanCronJobPingsJob.perform`: verifies both of its windows against a
 * real in-memory database — rows are deleted after `PING_RETENTION_DAYS`, and the
 * `source_ip`/`user_agent` details are nulled after the shorter detail window while the
 * row itself and its timing survive the full year.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BatchedLogger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

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
			source_ip: "203.0.113.1",
			user_agent: "curl/8.0",
		});
	}

	async function run(logger = new BatchedLogger("test")) {
		await container.scope(async () => {
			let job = new CleanCronJobPingsJob({ logger }, {});
			await job.perform();
		});

		return logger;
	}

	test("deletes pings older than the retention window and keeps the rest", async () => {
		let now = Date.now();
		let old = now - (PING_RETENTION_DAYS + 1) * MS_PER_DAY;
		let recent = now - 10 * MS_PER_DAY;

		await seedPing("ping-old", old);
		await seedPing("ping-recent", recent);

		await run();

		let remaining = await db.findMany(cronJobPings, {});
		expect(remaining.map((row) => row.id)).toEqual(["ping-recent"]);
	});

	test("does nothing when every ping is within the retention window", async () => {
		let now = Date.now();
		await seedPing("ping-recent-1", now - 1 * MS_PER_DAY);
		await seedPing("ping-recent-2", now - 2 * MS_PER_DAY);

		await run();

		let remaining = await db.findMany(cronJobPings, {});
		expect(remaining).toHaveLength(2);
	});

	test("logs the number of rows deleted", async () => {
		let now = Date.now();
		await seedPing("ping-old", now - (PING_RETENTION_DAYS + 1) * MS_PER_DAY);

		let logger = await run();

		let event = logger.events.find((entry) => entry.event === "job.clean_cron_job_pings.completed");
		expect(event).toBeDefined();
		expect(event?.rowsDeleted).toBe(1);
	});

	test("nulls source_ip and user_agent on pings past the detail window, keeping the row", async () => {
		let now = Date.now();
		await seedPing("ping-detailed", now - 31 * MS_PER_DAY);

		await run();

		let ping = await db.findOne(cronJobPings, { where: { id: "ping-detailed" } });
		expect(ping).toBeDefined();
		expect(ping?.source_ip).toBeNull();
		expect(ping?.user_agent).toBeNull();
		/** The timing the year-long window exists for is untouched. */
		expect(ping?.created_at).toBe(now - 31 * MS_PER_DAY);
	});

	test("keeps the details on a ping inside the detail window", async () => {
		let now = Date.now();
		await seedPing("ping-fresh", now - 29 * MS_PER_DAY);

		await run();

		let ping = await db.findOne(cronJobPings, { where: { id: "ping-fresh" } });
		expect(ping?.source_ip).toBe("203.0.113.1");
		expect(ping?.user_agent).toBe("curl/8.0");
	});

	test("logs deleted and redacted counts separately", async () => {
		let now = Date.now();
		await seedPing("ping-expired", now - (PING_RETENTION_DAYS + 1) * MS_PER_DAY);
		await seedPing("ping-detailed", now - 31 * MS_PER_DAY);
		await seedPing("ping-fresh", now - 1 * MS_PER_DAY);

		let logger = await run();

		let event = logger.events.find((entry) => entry.event === "job.clean_cron_job_pings.completed");
		expect(event?.rowsDeleted).toBe(1);
		expect(event?.rowsRedacted).toBe(1);
		expect(event?.reachedCeiling).toBe(false);
	});

	test("does not redact the same ping again on a later run", async () => {
		let now = Date.now();
		await seedPing("ping-detailed", now - 31 * MS_PER_DAY);

		await run();
		let logger = await run();

		let event = logger.events.find((entry) => entry.event === "job.clean_cron_job_pings.completed");
		expect(event?.rowsRedacted).toBe(0);
	});
});

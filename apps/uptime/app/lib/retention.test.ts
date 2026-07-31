/**
 * Unit tests for the bounded retention sweeps: that a sweep deletes or redacts exactly
 * the rows past its cutoff, that it does so in batches of the size it was given, that it
 * stops at its per-run ceiling instead of running until the table is empty, and that the
 * redaction loop terminates instead of re-redacting rows forever.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import {
	RETENTION_BATCH_SIZE,
	RETENTION_MAX_BATCHES,
	deleteOlderThan,
	redactOlderThan,
} from "~/app/lib/retention";
import { createTestDatabase } from "~/app/lib/test/db";
import { cronJobPings } from "~/database/schema";

describe("retention sweeps", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];

	beforeEach(() => {
		({ db } = createTestDatabase());
	});

	function seedPing(id: string, createdAt: number, detailed = true) {
		return db.create(cronJobPings, {
			id,
			created_at: createdAt,
			cron_job_monitor_id: "monitor-1",
			was_on_time: true,
			source_ip: detailed ? "203.0.113.1" : null,
			user_agent: detailed ? "curl/8.0" : null,
		});
	}

	async function seedPings(count: number, createdAt: number) {
		for (let index = 0; index < count; index++) {
			await seedPing(`ping-${index}`, createdAt);
		}
	}

	async function remainingIds() {
		let rows = await db.findMany(cronJobPings, {});
		return rows.map((row) => row.id).sort();
	}

	describe("deleteOlderThan", () => {
		test("deletes only the rows strictly older than the cutoff", async () => {
			await seedPing("old", 100);
			await seedPing("at-cutoff", 200);
			await seedPing("new", 300);

			let swept = await deleteOlderThan(db, "cron_job_pings", "created_at", 200);

			expect(swept.rowsAffected).toBe(1);
			expect(swept.batches).toBe(1);
			expect(swept.reachedCeiling).toBe(false);
			expect(await remainingIds()).toEqual(["at-cutoff", "new"]);
		});

		test("deletes nothing, in one statement, when no row is past the cutoff", async () => {
			await seedPing("new", 300);

			let swept = await deleteOlderThan(db, "cron_job_pings", "created_at", 100);

			expect(swept).toEqual({ rowsAffected: 0, batches: 1, reachedCeiling: false });
			expect(await remainingIds()).toEqual(["new"]);
		});

		test("deletes across as many batches as the batch size needs", async () => {
			await seedPings(7, 100);

			let swept = await deleteOlderThan(db, "cron_job_pings", "created_at", 200, { batchSize: 3 });

			expect(swept.rowsAffected).toBe(7);
			/** Three full batches of three, three, one — the short batch ends the sweep. */
			expect(swept.batches).toBe(3);
			expect(swept.reachedCeiling).toBe(false);
			expect(await remainingIds()).toEqual([]);
		});

		test("stops at the per-run ceiling and leaves the rest for the next run", async () => {
			await seedPings(10, 100);

			let swept = await deleteOlderThan(db, "cron_job_pings", "created_at", 200, {
				batchSize: 2,
				maxBatches: 3,
			});

			expect(swept.rowsAffected).toBe(6);
			expect(swept.batches).toBe(3);
			expect(swept.reachedCeiling).toBe(true);

			let remaining = await remainingIds();
			expect(remaining).toHaveLength(4);
		});

		test("a ceilinged sweep finishes the table on a later run", async () => {
			await seedPings(10, 100);

			await deleteOlderThan(db, "cron_job_pings", "created_at", 200, {
				batchSize: 2,
				maxBatches: 3,
			});
			let second = await deleteOlderThan(db, "cron_job_pings", "created_at", 200, {
				batchSize: 2,
				maxBatches: 3,
			});

			expect(second.rowsAffected).toBe(4);
			expect(second.reachedCeiling).toBe(false);
			expect(await remainingIds()).toEqual([]);
		});

		test("rejects a table or column that is not a plain identifier", async () => {
			await expect(
				deleteOlderThan(db, "cron_job_pings; DROP TABLE teams", "created_at", 200),
			).rejects.toThrow(/valid table or column identifier/);

			await expect(
				deleteOlderThan(db, "cron_job_pings", "created_at) OR (1=1", 200),
			).rejects.toThrow(/valid table or column identifier/);
		});

		test("rejects a non-positive batch size or ceiling", async () => {
			await expect(
				deleteOlderThan(db, "cron_job_pings", "created_at", 200, { batchSize: 0 }),
			).rejects.toThrow(/positive integer/);

			await expect(
				deleteOlderThan(db, "cron_job_pings", "created_at", 200, { maxBatches: -1 }),
			).rejects.toThrow(/positive integer/);
		});
	});

	describe("redactOlderThan", () => {
		test("nulls the listed columns on rows past the cutoff and keeps the rows", async () => {
			await seedPing("old", 100);
			await seedPing("new", 300);

			let swept = await redactOlderThan(
				db,
				"cron_job_pings",
				"created_at",
				["source_ip", "user_agent"],
				200,
			);

			expect(swept.rowsAffected).toBe(1);
			expect(await remainingIds()).toEqual(["new", "old"]);

			let old = await db.findOne(cronJobPings, { where: { id: "old" } });
			expect(old?.source_ip).toBeNull();
			expect(old?.user_agent).toBeNull();
			/** The rest of the row is untouched — this is field retention, not row retention. */
			expect(old?.cron_job_monitor_id).toBe("monitor-1");
			expect(old?.created_at).toBe(100);

			let recent = await db.findOne(cronJobPings, { where: { id: "new" } });
			expect(recent?.source_ip).toBe("203.0.113.1");
			expect(recent?.user_agent).toBe("curl/8.0");
		});

		test("terminates on a second run instead of redacting the same rows again", async () => {
			await seedPing("old", 100);

			let first = await redactOlderThan(
				db,
				"cron_job_pings",
				"created_at",
				["source_ip", "user_agent"],
				200,
			);
			let second = await redactOlderThan(
				db,
				"cron_job_pings",
				"created_at",
				["source_ip", "user_agent"],
				200,
			);

			expect(first.rowsAffected).toBe(1);
			/** Already-redacted rows no longer match, so the loop makes progress and ends. */
			expect(second).toEqual({ rowsAffected: 0, batches: 1, reachedCeiling: false });
		});

		test("redacts a row that has lost only one of the two columns", async () => {
			await db.create(cronJobPings, {
				id: "half",
				created_at: 100,
				cron_job_monitor_id: "monitor-1",
				was_on_time: false,
				source_ip: null,
				user_agent: "curl/8.0",
			});

			let swept = await redactOlderThan(
				db,
				"cron_job_pings",
				"created_at",
				["source_ip", "user_agent"],
				200,
			);

			expect(swept.rowsAffected).toBe(1);

			let row = await db.findOne(cronJobPings, { where: { id: "half" } });
			expect(row?.user_agent).toBeNull();
		});

		test("redacts in batches and honours the ceiling", async () => {
			await seedPings(10, 100);

			let swept = await redactOlderThan(
				db,
				"cron_job_pings",
				"created_at",
				["source_ip", "user_agent"],
				200,
				{ batchSize: 2, maxBatches: 3 },
			);

			expect(swept.rowsAffected).toBe(6);
			expect(swept.batches).toBe(3);
			expect(swept.reachedCeiling).toBe(true);

			let rows = await db.findMany(cronJobPings, {});
			expect(rows.filter((row) => row.source_ip === null)).toHaveLength(6);
		});

		test("rejects an empty column list", async () => {
			await expect(redactOlderThan(db, "cron_job_pings", "created_at", [], 200)).rejects.toThrow(
				/at least one column/,
			);
		});
	});

	test("the shipped defaults bound one run to a known number of rows", () => {
		expect(RETENTION_BATCH_SIZE).toBe(10_000);
		expect(RETENTION_MAX_BATCHES).toBe(20);
		expect(RETENTION_BATCH_SIZE * RETENTION_MAX_BATCHES).toBe(200_000);
	});
});

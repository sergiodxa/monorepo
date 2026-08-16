/**
 * Tests the sliding window against a real SQL engine (`bun:sqlite` through the
 * data-table sqlite adapter), so the queries themselves are exercised: counting,
 * denial at the limit, budget freeing as the oldest attempt ages out, and pruning.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, describe, expect, setSystemTime, test } from "bun:test";

import { isFailure, isSuccess, unwrap } from "@pkg/result";
import { createSqliteDatabase } from "remix/data-table/sqlite";

import { DataTableAdapter, RATE_LIMIT_HITS_SCHEMA_SQL, rateLimitHits } from "./data-table";
import { RateLimitError } from "./rate-limit-error";

/** A fixed instant, so every window boundary in a case is exact. */
const NOW = 1_700_000_000_000;

/** Builds an in-memory database with the package's own column contract applied. */
function createTestDatabase() {
	let sqlite = new SqliteDatabase(":memory:");
	sqlite.run(RATE_LIMIT_HITS_SCHEMA_SQL);
	return { sqlite, db: createSqliteDatabase(sqlite) };
}

/** Builds a database that has no rate limit table, standing in for a missing migration. */
function createBrokenDatabase() {
	return createSqliteDatabase(new SqliteDatabase(":memory:"));
}

/** Counts every stored attempt, including ones outside the window. */
async function countRows(db: ReturnType<typeof createTestDatabase>["db"]): Promise<number> {
	return await db.count(rateLimitHits);
}

afterEach(() => {
	setSystemTime();
});

describe("DataTableAdapter", () => {
	test("allows up to the limit and denies the next attempt", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 2, window: "10 seconds" });

		expect(unwrap(await adapter.consume("tenant")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("tenant")).allowed).toBe(true);

		let denied = unwrap(await adapter.consume("tenant"));
		expect(denied.allowed).toBe(false);
		expect(denied.remaining).toBe(0);
		expect(denied.limit).toBe(2);
	});

	test("reports the budget left and when it starts freeing up", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 10, window: "10 seconds" });

		let decision = unwrap(await adapter.consume("tenant"));

		expect(decision.remaining).toBe(9);
		expect(decision.reset.getTime()).toBe(NOW + 10_000);
		expect(decision.retryAfter).toBe(10);
	});

	test("dates the reset from the oldest attempt still in the window", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 1, window: "10 seconds" });

		await adapter.consume("tenant");

		setSystemTime(new Date(NOW + 6000));
		let denied = unwrap(await adapter.consume("tenant"));

		expect(denied.allowed).toBe(false);
		expect(denied.reset.getTime()).toBe(NOW + 10_000);
		expect(denied.retryAfter).toBe(4);
	});

	test("frees budget as the oldest attempt ages out, without a shared boundary", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 1, window: "10 seconds" });

		expect(unwrap(await adapter.consume("tenant")).allowed).toBe(true);

		setSystemTime(new Date(NOW + 9999));
		expect(unwrap(await adapter.consume("tenant")).allowed).toBe(false);

		setSystemTime(new Date(NOW + 10_001));
		expect(unwrap(await adapter.consume("tenant")).allowed).toBe(true);
	});

	test("deletes attempts that aged out of the window", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 5, window: "10 seconds" });

		await adapter.consume("tenant");
		await adapter.consume("tenant");
		expect(await countRows(db)).toBe(2);

		setSystemTime(new Date(NOW + 20_000));
		await adapter.consume("tenant");

		expect(await countRows(db)).toBe(1);
	});

	test("counts each key against its own budget", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 1, window: "10 seconds" });

		expect(unwrap(await adapter.consume("first")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("second")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("first")).allowed).toBe(false);
	});

	test("spends the requested cost as one attempt row", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 10, window: "10 seconds" });

		expect(unwrap(await adapter.consume("tenant", 4)).remaining).toBe(6);
		expect(await countRows(db)).toBe(1);
		expect(unwrap(await adapter.consume("tenant", 7)).allowed).toBe(false);
	});

	test("does not store a denied attempt", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 1, window: "10 seconds" });

		await adapter.consume("tenant");
		await adapter.consume("tenant");

		expect(await countRows(db)).toBe(1);
	});

	test("reset clears one key's attempts and leaves the others", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 1, window: "10 seconds" });

		await adapter.consume("first");
		await adapter.consume("second");

		expect(isSuccess(await adapter.reset("first"))).toBe(true);
		expect(await countRows(db)).toBe(1);
		expect(unwrap(await adapter.consume("first")).allowed).toBe(true);
		expect(unwrap(await adapter.consume("second")).allowed).toBe(false);
	});

	test("reports a failure when the table is missing", async () => {
		let adapter = new DataTableAdapter(createBrokenDatabase(), {
			limit: 5,
			window: "10 seconds",
		});

		let result = await adapter.consume("tenant");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error).toBeInstanceOf(RateLimitError);
		expect(result.error.backend).toBe("data-table");
		expect(result.error.key).toBe("tenant");
	});

	test("reports a failure when reset cannot run", async () => {
		let adapter = new DataTableAdapter(createBrokenDatabase(), {
			limit: 5,
			window: "10 seconds",
		});

		let result = await adapter.reset("tenant");

		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) return;
		expect(result.error.backend).toBe("data-table");
	});

	test("stores the bucket, cost, and instant of each counted attempt", async () => {
		setSystemTime(new Date(NOW));
		let { db } = createTestDatabase();
		let adapter = new DataTableAdapter(db, { limit: 10, window: "10 seconds" });

		await adapter.consume("tenant", 3);
		let rows = await db.findMany(rateLimitHits);

		expect(rows).toHaveLength(1);
		expect(rows[0]?.bucket).toBe("tenant");
		expect(rows[0]?.cost).toBe(3);
		expect(rows[0]?.created_at).toBe(NOW);
		expect(rows[0]?.id).toBeString();
	});
});

/**
 * Covers the per-`Database` signing-key cache: `SigningKey.getAll` memoizes imported
 * key pairs in a WeakMap keyed on the `Database` instance, so two different tenant
 * databases keep independent cached values (no cross-tenant key leakage) and
 * invalidation only affects the targeted tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDatabase } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";

import SigningKey from "./signing-key";

type Db = ReturnType<typeof createDatabase>;

describe("SigningKey per-Database cache isolation", () => {
	let sqliteA: SqliteDatabase;
	let sqliteB: SqliteDatabase;
	let dbA: Db;
	let dbB: Db;

	beforeEach(async () => {
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");

		sqliteA = new SqliteDatabase(":memory:");
		sqliteA.run(migration);
		dbA = createDatabase(createBunSqliteDatabaseAdapter(sqliteA));

		sqliteB = new SqliteDatabase(":memory:");
		sqliteB.run(migration);
		dbB = createDatabase(createBunSqliteDatabaseAdapter(sqliteB));
	});

	afterEach(() => {
		sqliteA.close();
		sqliteB.close();
	});

	test("one tenant's keys are never returned for another tenant", async () => {
		await SigningKey.generate(dbA);

		let keysA = await SigningKey.getAll(dbA);
		let keysB = await SigningKey.getAll(dbB);

		expect(keysA).toHaveLength(1);
		// dbB has no keys of its own, and must not see dbA's cached keys.
		expect(keysB).toHaveLength(0);
	});

	test("each Database caches its own distinct key set", async () => {
		await SigningKey.generate(dbA);
		await SigningKey.generate(dbB);

		let keysA = await SigningKey.getAll(dbA);
		let keysB = await SigningKey.getAll(dbB);

		expect(keysA).toHaveLength(1);
		expect(keysB).toHaveLength(1);
		// Independently generated key pairs -> different key ids.
		expect(keysA[0]!.id).not.toBe(keysB[0]!.id);
	});

	test("the same Database returns the cached (identical) key array on repeat calls", async () => {
		await SigningKey.generate(dbA);

		let first = await SigningKey.getAll(dbA);
		let second = await SigningKey.getAll(dbA);

		// A cache hit returns the very same array reference.
		expect(second).toBe(first);
	});

	test("invalidating one tenant's cache does not disturb another tenant's cache", async () => {
		await SigningKey.generate(dbA);
		await SigningKey.generate(dbB);

		let cachedA = await SigningKey.getAll(dbA);
		let cachedB = await SigningKey.getAll(dbB);

		SigningKey.invalidateCache(dbA);

		let afterA = await SigningKey.getAll(dbA);
		let afterB = await SigningKey.getAll(dbB);

		// dbA was rebuilt (new array), dbB still served from its untouched cache.
		expect(afterA).not.toBe(cachedA);
		expect(afterB).toBe(cachedB);
	});

	test("a fresh Database sees keys created before its first cache read", async () => {
		// No getAll call yet -> nothing cached; the first read must hit the database.
		await SigningKey.generate(dbA);
		expect(await SigningKey.getAll(dbA)).toHaveLength(1);
	});
});

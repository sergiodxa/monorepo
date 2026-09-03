/**
 * Covers the per-`Database` signing-key cache: `SigningKey.getAll` memoizes imported
 * key pairs in a WeakMap keyed on the `Database` instance, so two different tenant
 * databases keep independent cached values (no cross-tenant key leakage) and
 * invalidation only affects the targeted tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SqliteDatabase } from "@sdxc/cloudflare-mocks/sqlite";

import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { JWK, JWT } from "@sdxc/jwt";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createSqliteDatabaseAdapter } from "../../shared/test/db.js";

import SigningKey from "./signing-key.js";

type Db = Database;

describe("SigningKey per-Database cache isolation", () => {
	let sqliteA: SqliteDatabase;
	let sqliteB: SqliteDatabase;
	let dbA: Db;
	let dbB: Db;

	beforeEach(async () => {
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");

		sqliteA = openDatabase(":memory:");
		sqliteA.exec(migration);
		dbA = new Database(createSqliteDatabaseAdapter(sqliteA));

		sqliteB = openDatabase(":memory:");
		sqliteB.exec(migration);
		dbB = new Database(createSqliteDatabaseAdapter(sqliteB));
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
		expect(keysB).toHaveLength(0);
	});

	test("each Database caches its own distinct key set", async () => {
		await SigningKey.generate(dbA);
		await SigningKey.generate(dbB);

		let keysA = await SigningKey.getAll(dbA);
		let keysB = await SigningKey.getAll(dbB);

		expect(keysA).toHaveLength(1);
		expect(keysB).toHaveLength(1);
		expect(keysA[0]!.id).not.toBe(keysB[0]!.id);
	});

	test("the same Database returns the cached (identical) key array on repeat calls", async () => {
		await SigningKey.generate(dbA);

		let first = await SigningKey.getAll(dbA);
		let second = await SigningKey.getAll(dbA);

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

		expect(afterA).not.toBe(cachedA);
		expect(afterB).toBe(cachedB);
	});

	test("a fresh Database sees keys created before its first cache read", async () => {
		await SigningKey.generate(dbA);
		expect(await SigningKey.getAll(dbA)).toHaveLength(1);
	});
});

describe("SigningKey algorithm handling", () => {
	let sqlite: SqliteDatabase;
	let db: Db;

	beforeEach(async () => {
		let { default: migration } = await import("../../migrations/0001-init.sql?raw");

		sqlite = openDatabase(":memory:");
		sqlite.exec(migration);
		db = new Database(createSqliteDatabaseAdapter(sqlite));
	});

	afterEach(() => sqlite.close());

	/** Stores one key under the given algorithm, as a row written outside `generate`. */
	async function store(algorithm: string, alg: JWK.Algorithm): Promise<string> {
		let raw = await JWK.generateKeyPair(alg);

		await db.create(SigningKey.table, {
			id: raw.id,
			private_key: raw.privateKey,
			public_key: raw.publicKey,
			algorithm,
			is_current: true,
			created_at: new Date().toISOString(),
			expires_at: null,
		});

		return raw.id;
	}

	test("imports a stored key under the algorithm the row names", async () => {
		await store(JWK.Algorithm.RS256, JWK.Algorithm.RS256);

		let current = await SigningKey.getCurrent(db);

		expect(current?.alg).toBe(JWK.Algorithm.RS256);
	});

	test("imports every stored key under its own algorithm", async () => {
		await store(JWK.Algorithm.RS256, JWK.Algorithm.RS256);

		let keys = await SigningKey.getAll(db);

		expect(keys.map((key) => key.alg)).toEqual([JWK.Algorithm.RS256]);
	});

	test("a key signs and verifies under the algorithm it was stored with", async () => {
		await store(JWK.Algorithm.RS256, JWK.Algorithm.RS256);

		let keys = await SigningKey.getAll(db);
		let signed = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.RS256, keys);

		let verified = await JWT.verify(signed, await JWK.importLocal(JWK.toJSON(keys)), {
			algorithms: [JWK.Algorithm.RS256],
		});

		expect(verified.subject).toBe("user-123");
	});

	test("stores the algorithm the generated key actually uses", async () => {
		await SigningKey.generate(db);

		let [record] = await SigningKey.list(db);

		expect(record?.algorithm).toBe(JWK.Algorithm.ES256);
	});

	test("reports a row naming an algorithm it cannot import", async () => {
		let id = await store("HS256", JWK.Algorithm.ES256);

		await expect(SigningKey.getCurrent(db)).rejects.toThrow(
			`Signing key ${id} names an unsupported algorithm: HS256`,
		);
		await expect(SigningKey.getAll(db)).rejects.toThrow(
			SigningKey.UnsupportedAlgorithmError as unknown as ErrorConstructor,
		);
	});
});

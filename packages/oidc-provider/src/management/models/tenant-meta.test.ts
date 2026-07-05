/**
 * Covers the per-`Database` issuer cache on TenantMeta: `getIssuer` memoizes the
 * issuer in a WeakMap keyed on the `Database` instance, so two different tenant
 * databases resolve independent issuers (no cross-tenant leak) and setIssuer only
 * invalidates the targeted tenant's cached value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { Database as SqliteDatabase } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { createDatabase } from "remix/data-table";

import { createBunSqliteDatabaseAdapter } from "../../shared/test/db";

import TenantMeta from "./tenant-meta";

type Db = ReturnType<typeof createDatabase>;

describe("TenantMeta per-Database issuer cache isolation", () => {
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

	test("each Database resolves its own issuer", async () => {
		await TenantMeta.setIssuer(dbA, "tenant-a.example.com");
		await TenantMeta.setIssuer(dbB, "tenant-b.example.com");

		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a.example.com");
		expect(await TenantMeta.getIssuer(dbB)).toBe("tenant-b.example.com");
	});

	test("one tenant's cached issuer never leaks to another Database", async () => {
		await TenantMeta.setIssuer(dbA, "tenant-a.example.com");
		// Prime dbA's cache.
		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a.example.com");

		// dbB has no issuer configured and must not see dbA's cached value.
		expect(await TenantMeta.getIssuer(dbB)).toBeNull();
	});

	test("setIssuer invalidates only the targeted Database's cache", async () => {
		await TenantMeta.setIssuer(dbA, "tenant-a.example.com");
		await TenantMeta.setIssuer(dbB, "tenant-b.example.com");

		// Prime both caches.
		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a.example.com");
		expect(await TenantMeta.getIssuer(dbB)).toBe("tenant-b.example.com");

		// Rotate dbA's issuer; dbB's cached value must stay intact.
		await TenantMeta.setIssuer(dbA, "tenant-a-renamed.example.com");

		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a-renamed.example.com");
		expect(await TenantMeta.getIssuer(dbB)).toBe("tenant-b.example.com");
	});

	test("a null issuer is cached per Database and served on repeat reads", async () => {
		// First read caches the null; a later write is not reflected until the TTL or
		// an explicit setIssuer invalidation (setIssuer clears it).
		expect(await TenantMeta.getIssuer(dbA)).toBeNull();

		// Writing through the low-level set() bypasses cache invalidation, so the
		// cached null is still served (demonstrating the cache is keyed to dbA).
		await TenantMeta.set(dbA, TenantMeta.KEYS.ISSUER, "written-directly.example.com");
		expect(await TenantMeta.getIssuer(dbA)).toBeNull();

		// setIssuer clears the cache, after which the fresh value is visible.
		await TenantMeta.setIssuer(dbA, "proper.example.com");
		expect(await TenantMeta.getIssuer(dbA)).toBe("proper.example.com");
	});
});

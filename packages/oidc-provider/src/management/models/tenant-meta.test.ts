/**
 * Covers the per-`Database` issuer cache on TenantMeta: `getIssuer` memoizes the
 * issuer in a WeakMap keyed on the `Database` instance, so two different tenant
 * databases resolve independent issuers (no cross-tenant leak) and setIssuer only
 * invalidates the targeted tenant's cached value.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { SqliteDatabase } from "@sdxc/cloudflare-mocks/sqlite";

import { openDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createSqliteDatabaseAdapter } from "../../shared/test/db.js";

import TenantMeta from "./tenant-meta.js";

type Db = Database;

describe("TenantMeta per-Database issuer cache isolation", () => {
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

	test("each Database resolves its own issuer", async () => {
		await TenantMeta.setIssuer(dbA, "tenant-a.example.com");
		await TenantMeta.setIssuer(dbB, "tenant-b.example.com");

		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a.example.com");
		expect(await TenantMeta.getIssuer(dbB)).toBe("tenant-b.example.com");
	});

	test("one tenant's cached issuer never leaks to another Database", async () => {
		await TenantMeta.setIssuer(dbA, "tenant-a.example.com");
		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a.example.com");

		expect(await TenantMeta.getIssuer(dbB)).toBeNull();
	});

	test("setIssuer invalidates only the targeted Database's cache", async () => {
		await TenantMeta.setIssuer(dbA, "tenant-a.example.com");
		await TenantMeta.setIssuer(dbB, "tenant-b.example.com");

		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a.example.com");
		expect(await TenantMeta.getIssuer(dbB)).toBe("tenant-b.example.com");

		await TenantMeta.setIssuer(dbA, "tenant-a-renamed.example.com");

		expect(await TenantMeta.getIssuer(dbA)).toBe("tenant-a-renamed.example.com");
		expect(await TenantMeta.getIssuer(dbB)).toBe("tenant-b.example.com");
	});

	test("a null issuer is cached per Database and served on repeat reads", async () => {
		expect(await TenantMeta.getIssuer(dbA)).toBeNull();

		await TenantMeta.set(dbA, TenantMeta.KEYS.ISSUER, "written-directly.example.com");
		expect(await TenantMeta.getIssuer(dbA)).toBeNull();

		await TenantMeta.setIssuer(dbA, "proper.example.com");
		expect(await TenantMeta.getIssuer(dbA)).toBe("proper.example.com");
	});
});

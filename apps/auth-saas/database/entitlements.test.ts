/**
 * Exercises `applyEntitlements` directly against a `Database` over a real
 * SQLite-backed `SqlStorage`, the way `mail-rate-limit.test.ts` drives its own
 * leaf module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { applyEntitlements, entitlementEnforcement } from "./entitlements";
import entitlementsMigration from "./tenant-migrations/0012-entitlements.sql?raw";

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await driver.executeScript(entitlementsMigration);
	db = new Database(driver);
});

describe("applyEntitlements", () => {
	test("writes the tenant-local enforcement record", async () => {
		let result = await applyEntitlements(db, {
			plan: "pro",
			features: { sso: true },
			dauCap: 5000,
			auditRetentionDays: 90,
			effectiveAt: 1_700_000_000_000,
		});

		expect(result).toEqual({ plan: "pro", prunedRows: 0 });

		let rows = await db.findMany(entitlementEnforcement);
		expect(rows).toEqual([
			{
				id: "current",
				plan: "pro",
				features: { sso: true },
				dau_cap: 5000,
				audit_retention_days: 90,
				effective_at: 1_700_000_000_000,
			},
		]);
	});

	test("replaces the record wholesale rather than merging into it", async () => {
		await applyEntitlements(db, {
			plan: "pro",
			features: { sso: true, reports: true },
			dauCap: 5000,
			auditRetentionDays: 90,
			effectiveAt: 1_700_000_000_000,
		});

		let result = await applyEntitlements(db, {
			plan: "free",
			features: {},
			dauCap: 100,
			auditRetentionDays: 7,
			effectiveAt: 1_700_000_100_000,
		});

		expect(result).toEqual({ plan: "free", prunedRows: 0 });

		let rows = await db.findMany(entitlementEnforcement);
		expect(rows).toEqual([
			{
				id: "current",
				plan: "free",
				features: {},
				dau_cap: 100,
				audit_retention_days: 7,
				effective_at: 1_700_000_100_000,
			},
		]);
	});

	test("prunedRows is always 0, ahead of ADR-023's audit log", async () => {
		let result = await applyEntitlements(db, {
			plan: "premium",
			features: {},
			dauCap: null,
			auditRetentionDays: null,
			effectiveAt: 1_700_000_000_000,
		});

		expect(result.prunedRows).toBe(0);
	});
});

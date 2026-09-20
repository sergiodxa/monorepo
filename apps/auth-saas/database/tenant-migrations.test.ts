/**
 * Verifies the tenant object's schema registry against a real SQLite database: that
 * applying it is repeatable, and that every table `0001-init` declares exists.
 *
 * `settings` holds one row per tenant and is never paginated, so there is no paging read
 * to assert answers from an index yet; that assertion applies once a table here is read a
 * page at a time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { beforeEach, describe, expect, test } from "vitest";

import { runMigrations } from "./tenant-migrations";

let sql: ReturnType<typeof createSqlStorage>;

beforeEach(() => {
	sql = createSqlStorage();
});

/** Applies every migration and hands back the storage they were applied to. */
async function migrate() {
	return await runMigrations(createSQLStorageDatabaseAdapter(sql));
}

describe("runMigrations", () => {
	test("applies every migration, in the order they are journaled", async () => {
		expect((await migrate()).applied).toEqual([
			"0001-init",
			"0002-subjects",
			"0003-passwords",
			"0004-passkeys",
			"0005-sessions",
			"0006-signing-keys",
			"0007-clients",
			"0008-consent",
			"0009-authorization",
			"0010-tokens",
			"0011-mail-rate-limit",
			"0012-entitlements",
		]);
	});

	test("does nothing on a database already migrated", async () => {
		await migrate();
		expect((await migrate()).applied).toEqual([]);
	});

	test("creates every table the scripts declare", async () => {
		await migrate();

		let names = [
			...sql.exec<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`),
		].map((row) => row.name);

		for (let name of [
			"schema_migrations",
			"settings",
			"subjects",
			"subject_identifiers",
			"subject_attributes",
			"attribute_definitions",
			"passwords",
			"password_policy",
			"password_reset_tickets",
			"passkeys",
			"passkey_challenges",
			"sessions",
			"signing_keys",
			"custom_claims",
			"clients",
			"client_secrets",
			"scopes",
			"grants",
			"authorization_requests",
			"authorization_codes",
		]) {
			expect(names, `${name} exists`).toContain(name);
		}
	});

	test("journals every migration's id alongside when it ran", async () => {
		await migrate();

		let rows = [
			...sql.exec<{ id: string; applied_at: number }>(
				`SELECT id, applied_at FROM schema_migrations`,
			),
		];

		expect(rows).toEqual([
			{ id: "0001-init", applied_at: expect.any(Number) },
			{ id: "0002-subjects", applied_at: expect.any(Number) },
			{ id: "0003-passwords", applied_at: expect.any(Number) },
			{ id: "0004-passkeys", applied_at: expect.any(Number) },
			{ id: "0005-sessions", applied_at: expect.any(Number) },
			{ id: "0006-signing-keys", applied_at: expect.any(Number) },
			{ id: "0007-clients", applied_at: expect.any(Number) },
			{ id: "0008-consent", applied_at: expect.any(Number) },
			{ id: "0009-authorization", applied_at: expect.any(Number) },
			{ id: "0010-tokens", applied_at: expect.any(Number) },
			{ id: "0011-mail-rate-limit", applied_at: expect.any(Number) },
			{ id: "0012-entitlements", applied_at: expect.any(Number) },
		]);
	});

	test("indexes the uniqueness rule and the retention sweep's predicate", async () => {
		await migrate();

		let plan = [
			...sql.exec(
				`EXPLAIN QUERY PLAN SELECT * FROM subject_identifiers WHERE kind = 'email' AND folded = 'a@example.com'`,
			),
		];
		expect(JSON.stringify(plan)).toContain("subject_identifiers_kind_folded_idx");

		let sweepPlan = [
			...sql.exec(
				`EXPLAIN QUERY PLAN SELECT * FROM subject_identifiers WHERE verified_at IS NULL AND created_at < 0`,
			),
		];
		expect(JSON.stringify(sweepPlan)).toContain("subject_identifiers_unverified_idx");
	});
});

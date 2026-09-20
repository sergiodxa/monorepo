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
		expect((await migrate()).applied).toEqual(["0001-init"]);
	});

	test("does nothing on a database already migrated", async () => {
		await migrate();
		expect((await migrate()).applied).toEqual([]);
	});

	test("creates every table the 0001-init script declares", async () => {
		await migrate();

		let names = [
			...sql.exec<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`),
		].map((row) => row.name);

		for (let name of ["schema_migrations", "settings"]) {
			expect(names, `${name} exists`).toContain(name);
		}
	});

	test("journals the migration's id alongside when it ran", async () => {
		await migrate();

		let rows = [
			...sql.exec<{ id: string; applied_at: number }>(
				`SELECT id, applied_at FROM schema_migrations`,
			),
		];

		expect(rows).toEqual([{ id: "0001-init", applied_at: expect.any(Number) }]);
	});
});

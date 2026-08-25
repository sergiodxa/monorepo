/**
 * Tests for {@link runMigrations}, the engine's schema migration runner.
 *
 * The case that matters here is the fresh database: every host provisions a new tenant by
 * running the whole chain from empty, so a chain that only works against a database which
 * already ran an earlier version of it cannot provision anything. Nothing exercised that
 * path before — the model tests each apply `0001-init.sql` alone — which is how a migration
 * re-adding a column `0001` already creates went unnoticed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SqliteDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createSqliteDatabaseAdapter } from "../shared/test/db";

import { MIGRATIONS, runMigrations } from "./migrations";

describe(runMigrations, () => {
	let sqliteDb: SqliteDatabase;

	beforeEach(() => {
		sqliteDb = openDatabase(":memory:");
	});

	afterEach(() => {
		sqliteDb.close();
	});

	test("applies the whole chain against an empty database", async () => {
		let { applied } = await runMigrations(createSqliteDatabaseAdapter(sqliteDb));

		expect(applied).toEqual(MIGRATIONS.map((migration) => migration.id));
	});

	test("the finished schema still carries the PKCE columns 0003 was added for", async () => {
		await runMigrations(createSqliteDatabaseAdapter(sqliteDb));

		let columns = sqliteDb
			.query("SELECT name FROM pragma_table_info('webauthn_challenges')")
			.all() as { name: string }[];

		expect(columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(["pkce_challenge", "pkce_method"]),
		);
	});

	test("is idempotent: a second run applies nothing", async () => {
		let adapter = createSqliteDatabaseAdapter(sqliteDb);
		await runMigrations(adapter);

		let { applied } = await runMigrations(adapter);

		expect(applied).toEqual([]);
	});

	test("journals every applied id, so a later chain resumes rather than replaying", async () => {
		let adapter = createSqliteDatabaseAdapter(sqliteDb);
		await runMigrations(adapter);

		let journaled = sqliteDb.query("SELECT id FROM oidc_migrations ORDER BY id").all() as {
			id: string;
		}[];

		expect(journaled.map((row) => row.id)).toEqual(MIGRATIONS.map((migration) => migration.id));
	});
});

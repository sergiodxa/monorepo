/**
 * The local database a command reads as `ctx.db`: where `wrangler.jsonc` puts its file, and how
 * it writes timestamps and JSON columns, opened in memory so the test leaves the project's own copy untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { column as c, table } from "remix/data-table";
import { describe, expect, test } from "vitest";

import {
	DATABASE,
	LOCAL_DATABASE_FILE,
	openLocalDatabase,
} from "~/app/initializers/local-database";
import { recordJobs } from "~/app/test/models";

/** A table with a `c.json()` column, which SQLite can bind only as text. */
const SETTINGS = table({
	name: "settings",
	columns: { id: c.text().primaryKey(), config: c.json() },
});

/** A table with the timestamp columns `sdxc make model` writes. */
const POSTS = table({
	name: "posts",
	columns: { id: c.text().primaryKey(), created_at: c.integer(), updated_at: c.integer() },
	timestamps: true,
});

describe("DATABASE", () => {
	test("reads the DB binding's database from wrangler.jsonc", () => {
		expect(DATABASE).toEqual({
			name: "ping",
			id: "b51fff7c-c4dd-412d-8b56-57da405b780e",
			migrationsDirectory: "./database/migrations",
		});
	});

	test("names the file Miniflare keeps that database in", () => {
		expect(LOCAL_DATABASE_FILE).toMatch(
			/\.wrangler\/state\/v3\/d1\/miniflare-D1DatabaseObject\/340c9e1ac866a2eb579adfcb67853e9fd24074bb588ac9801d85dc76f191f134\.sqlite$/,
		);
	});
});

describe("openLocalDatabase", () => {
	test("writes timestamps as epoch milliseconds, as the Worker's database does", async () => {
		let db = openLocalDatabase(":memory:");
		await db.exec(
			"CREATE TABLE posts (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
		);

		let posts = createModel(POSTS, {}).bind({ db, jobs: recordJobs().jobs });

		let row = unwrap(await posts.create({ id: "p1" }));

		expect(typeof row.created_at).toBe("number");
	});

	test("stores a JSON column as JSON text and reads it back as the value", async () => {
		let db = openLocalDatabase(":memory:");
		await db.exec("CREATE TABLE settings (id TEXT PRIMARY KEY, config TEXT NOT NULL)");
		let settings = createModel(SETTINGS, {}).bind({ db, jobs: recordJobs().jobs });

		unwrap(await settings.create({ id: "s1", config: { strategy: "email" } }));

		let stored = await db.exec("SELECT config FROM settings");
		expect(stored.rows).toEqual([{ config: '{"strategy":"email"}' }]);
		expect((await settings.find("s1"))?.config).toEqual({ strategy: "email" });
	});
});

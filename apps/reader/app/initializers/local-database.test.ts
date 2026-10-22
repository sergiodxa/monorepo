/**
 * The local catalog a command reads as `ctx.db`, opened in memory so the test leaves the
 * project's own copy untouched, and the catalog entry read from `wrangler.jsonc`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { column as c, table } from "remix/data-table";
import { describe, expect, test } from "vite-plus/test";

import { CATALOG, LOCAL_DATABASE_FILE, openLocalDatabase } from "~/app/initializers/local-database";

/** A table with the timestamp columns `sdxc make model` writes. */
const POSTS = table({
	name: "posts",
	columns: { id: c.text().primaryKey(), created_at: c.integer(), updated_at: c.integer() },
	timestamps: true,
});

describe("openLocalDatabase", () => {
	test("writes timestamps as epoch milliseconds, as the Worker's database does", async () => {
		let db = openLocalDatabase(":memory:");
		await db.exec(
			"CREATE TABLE posts (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
		);

		let posts = createModel(POSTS, {}).bind({ db });

		let row = unwrap(await posts.create({ id: "p1" }));

		expect(typeof row.created_at).toBe("number");
	});
});

describe("CATALOG", () => {
	test("names the PLATFORM_DB database and its chain from wrangler.jsonc", () => {
		expect(CATALOG.name).toBe("reader-catalog");
		expect(CATALOG.migrationsDirectory).toBe("./database/catalog-migrations");
	});

	test("points at the file Wrangler keeps the local copy in", () => {
		expect(LOCAL_DATABASE_FILE).toContain(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/");
		expect(LOCAL_DATABASE_FILE).toMatch(/[0-9a-f]{64}\.sqlite$/);
	});
});

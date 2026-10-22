/**
 * The local database a command reads as `ctx.db`, opened in memory so the test leaves the
 * project's own copy untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basename } from "node:path";

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { column as c, table } from "remix/data-table";
import { describe, expect, test } from "vite-plus/test";

import {
	DATABASE_NAME,
	LOCAL_DATABASE_FILE,
	openLocalDatabase,
} from "~/app/initializers/local-database";

/** A table with the timestamp columns every blog table carries. */
const POSTS = table({
	name: "posts",
	columns: { id: c.text().primaryKey(), created_at: c.text(), updated_at: c.text() },
	timestamps: true,
});

describe("openLocalDatabase", () => {
	test("writes timestamps as ISO 8601 strings, as the Worker's database does", async () => {
		let db = openLocalDatabase(":memory:");
		await db.exec(
			"CREATE TABLE posts (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
		);

		let posts = createModel(POSTS, {}).bind({ db });

		let row = unwrap(await posts.create({ id: "p1" }));

		expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
	});
});

describe("LOCAL_DATABASE_FILE", () => {
	test("is the file Miniflare keeps the DB binding's database in", () => {
		expect(DATABASE_NAME).toBe("db");
		expect(basename(LOCAL_DATABASE_FILE)).toBe(
			"5d64ca0609c777e3ff47d48f16a0efd44af7c81c6116d10ab8d41a4332764ded.sqlite",
		);
	});
});

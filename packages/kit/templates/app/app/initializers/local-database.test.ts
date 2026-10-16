/**
 * The local database a command reads as `ctx.db`, opened in memory so the test leaves the
 * project's own copy untouched.
 */

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { column as c, table } from "remix/data-table";
import { describe, expect, test } from "vitest";

import { openLocalDatabase } from "~/app/initializers/local-database";

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

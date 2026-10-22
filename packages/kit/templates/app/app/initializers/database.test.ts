/**
 * The database the router and the job dispatcher publish as `ctx.db`, run against the
 * in-memory D1 stand-in tests receive as the `DB` binding.
 */

import { describe, expect, test } from "vite-plus/test";

import { openDatabase } from "~/app/initializers/database";

describe("openDatabase", () => {
	test("runs SQL through the DB binding", async () => {
		let db = openDatabase();

		let result = await db.exec("SELECT 41 + 1 AS answer");

		expect(result.rows).toEqual([{ answer: 42 }]);
	});
});

/**
 * The database the router and the job dispatcher publish as `ctx.db`, run against the
 * in-memory D1 stand-in tests receive as the `DB` binding, and the migration chain applied to it.
 */

import { describe, expect, test } from "vitest";

import { openDatabase } from "~/app/initializers/database";
import { migrate } from "~/app/test/database";

describe("openDatabase", () => {
	test("runs SQL through the DB binding", async () => {
		let db = openDatabase();

		let result = await db.exec("SELECT 41 + 1 AS answer");

		expect(result.rows).toEqual([{ answer: 42 }]);
	});

	test("takes every migration in database/migrations/ on an empty binding", async () => {
		await expect(migrate()).resolves.toBeUndefined();
	});
});

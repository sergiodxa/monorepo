/**
 * Pins that every statement the blog's database runs is totalled on the wide event of the
 * request or job running it, which is what makes a page's database cost visible per route,
 * and that a statement run outside any invocation still answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { sql } from "remix/data-table";
import { describe, expect, test } from "vitest";

import { testDatabase } from "~/app/test/database";

describe("openDatabase", () => {
	test("totals each statement's D1 cost on the current log", async () => {
		let db = await testDatabase();
		let records: Record<string, unknown>[] = [];
		let log = new Log({ kind: "request", sink: (record) => records.push(record) });

		await log.run(async () => {
			await db.exec(sql`select 1 as "one"`);
			await db.exec(sql`select 2 as "two"`);
		});

		expect(records).toHaveLength(1);
		let [record] = records;
		expect(record?.["d1.count"]).toBe(2);
		expect(record?.["d1.rows_read"]).toBe(2);
		expect(record?.["d1.rows_written"]).toBe(0);
		expect(typeof record?.["d1.duration_ms"]).toBe("number");
	});

	test("runs a statement outside any invocation", async () => {
		let db = await testDatabase();

		let result = await db.exec(sql`select 1 as "one"`);

		expect(result.rows).toEqual([{ one: 1 }]);
	});
});

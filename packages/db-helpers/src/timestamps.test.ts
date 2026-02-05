import { describe, expect, test } from "bun:test";

import { sqliteTable } from "drizzle-orm/sqlite-core";

import { timestamp } from "./timestamps";

describe("timestamp", () => {
	test("creates an integer column with timestamp_ms mode", () => {
		let table = sqliteTable("test", {
			createdAt: timestamp("created_at"),
		});

		expect(table.createdAt.name).toBe("created_at");
		expect(table.createdAt.dataType).toBe("date");
		expect(table.createdAt.columnType).toBe("SQLiteTimestamp");
	});

	test("is nullable by default", () => {
		let table = sqliteTable("test", {
			createdAt: timestamp("created_at"),
		});

		expect(table.createdAt.notNull).toBe(false);
	});

	test("can be chained with notNull and default", () => {
		let table = sqliteTable("test", {
			createdAt: timestamp("created_at")
				.notNull()
				.$defaultFn(() => new Date()),
		});

		expect(table.createdAt.notNull).toBe(true);
		expect(table.createdAt.defaultFn).toBeDefined();
	});
});

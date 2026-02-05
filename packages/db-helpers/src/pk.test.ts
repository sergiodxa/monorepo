import { describe, expect, test } from "bun:test";

import { sqliteTable } from "drizzle-orm/sqlite-core";

import { pk } from "./pk";

describe("pk", () => {
	test("creates a primary key column", () => {
		let table = sqliteTable("test", {
			id: pk("id"),
		});

		expect(table.id.name).toBe("id");
		expect(table.id.primary).toBe(true);
		expect(table.id.isUnique).toBe(true);
		expect(table.id.dataType).toBe("string");
	});

	test("generates a UUID by default", () => {
		let table = sqliteTable("test", {
			id: pk("id"),
		});

		let defaultFn = table.id.defaultFn;
		expect(defaultFn).toBeDefined();

		let generatedId = defaultFn!();
		expect(typeof generatedId).toBe("string");
		expect(generatedId as string).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		);
	});

	test("generates unique UUIDs", () => {
		let table = sqliteTable("test", {
			id: pk("id"),
		});

		let defaultFn = table.id.defaultFn!;
		let ids = new Set<unknown>();

		for (let i = 0; i < 100; i++) {
			ids.add(defaultFn());
		}

		expect(ids.size).toBe(100);
	});

	test("uses custom column name", () => {
		let table = sqliteTable("test", {
			customId: pk("custom_id"),
		});

		expect(table.customId.name).toBe("custom_id");
	});
});

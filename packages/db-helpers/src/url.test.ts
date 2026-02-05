import { describe, expect, test } from "bun:test";

import { sqliteTable } from "drizzle-orm/sqlite-core";

import { url } from "./url";

describe("url", () => {
	test("creates a text column", () => {
		let table = sqliteTable("test", {
			avatarUrl: url("avatar_url"),
		});

		expect(table.avatarUrl.name).toBe("avatar_url");
		expect(table.avatarUrl.dataType).toBe("string");
	});

	test("is not unique by default", () => {
		let table = sqliteTable("test", {
			avatarUrl: url("avatar_url"),
		});

		expect(table.avatarUrl.isUnique).toBe(false);
	});

	test("is nullable by default", () => {
		let table = sqliteTable("test", {
			avatarUrl: url("avatar_url"),
		});

		expect(table.avatarUrl.notNull).toBe(false);
	});
});

import { describe, expect, test } from "bun:test";

import { sqliteTable } from "drizzle-orm/sqlite-core";

import { email } from "./email";

describe("email", () => {
	test("creates a text column", () => {
		let table = sqliteTable("test", {
			email: email("email"),
		});

		expect(table.email.name).toBe("email");
		expect(table.email.dataType).toBe("string");
	});

	test("is not unique by default", () => {
		let table = sqliteTable("test", {
			email: email("email"),
		});

		expect(table.email.isUnique).toBe(false);
	});

	test("is nullable by default", () => {
		let table = sqliteTable("test", {
			email: email("email"),
		});

		expect(table.email.notNull).toBe(false);
	});

	test("can be chained with unique and notNull", () => {
		let table = sqliteTable("test", {
			email: email("email").notNull().unique(),
		});

		expect(table.email.notNull).toBe(true);
		expect(table.email.isUnique).toBe(true);
	});
});

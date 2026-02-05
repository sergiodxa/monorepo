import { describe, expect, test } from "bun:test";

import { sqliteTable } from "drizzle-orm/sqlite-core";

import { pk } from "./pk";
import { uuid } from "./uuid";

describe("uuid", () => {
	test("creates a unique text column", () => {
		let table = sqliteTable("test", {
			externalId: uuid("external_id"),
		});

		expect(table.externalId.name).toBe("external_id");
		expect(table.externalId.isUnique).toBe(true);
		expect(table.externalId.dataType).toBe("string");
	});

	test("is not a primary key", () => {
		let table = sqliteTable("test", {
			id: pk("id"),
			externalId: uuid("external_id"),
		});

		expect(table.externalId.primary).toBe(false);
	});

	test("does not have a default value", () => {
		let table = sqliteTable("test", {
			externalId: uuid("external_id"),
		});

		expect(table.externalId.defaultFn).toBeUndefined();
	});
});

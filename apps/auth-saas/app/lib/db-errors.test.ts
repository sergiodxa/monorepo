/**
 * Behavioural tests for the database error classes: each carries a stable `name`,
 * preserves the table/column/value that triggered it, and formats a descriptive
 * message embedding the table name and offending value. Pure logic over an
 * in-code table definition; no database connection required.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { column as c, table } from "remix/data-table";

import { DuplicateRecordError, ForeignKeyError, RecordNotFoundError } from "./db-errors";

let users = table({
	name: "users",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		email: c.text(),
		tenant_id: c.text(),
	},
});

describe("RecordNotFoundError", () => {
	test("is an Error with a stable name", () => {
		let error = new RecordNotFoundError(users, { id: "abc" });
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe("RecordNotFoundError");
	});

	test("preserves the table and looked-up id", () => {
		let error = new RecordNotFoundError(users, { id: "abc" });
		expect(error.table).toBe(users);
		expect(error.id).toEqual({ id: "abc" });
	});

	test("formats a message with the table name and id", () => {
		let error = new RecordNotFoundError(users, { id: "abc" });
		expect(error.message).toBe('users record with id {"id":"abc"} not found');
	});
});

describe("DuplicateRecordError", () => {
	test("has a stable name and preserves the conflicting column and value", () => {
		let error = new DuplicateRecordError(users, "email", "a@example.test");
		expect(error.name).toBe("DuplicateRecordError");
		expect(error.column).toBe("email");
		expect(error.value).toBe("a@example.test");
	});

	test("formats a message naming the duplicated column and value", () => {
		let error = new DuplicateRecordError(users, "email", "a@example.test");
		expect(error.message).toBe('users record with email "a@example.test" already exists');
	});
});

describe("ForeignKeyError", () => {
	test("has a stable name and preserves the failing column and value", () => {
		let error = new ForeignKeyError(users, "tenant_id", "missing-tenant");
		expect(error.name).toBe("ForeignKeyError");
		expect(error.column).toBe("tenant_id");
		expect(error.value).toBe("missing-tenant");
	});

	test("formats a message describing the failed foreign-key constraint", () => {
		let error = new ForeignKeyError(users, "tenant_id", "missing-tenant");
		expect(error.message).toBe(
			'users foreign key constraint failed for tenant_id with value "missing-tenant"',
		);
	});
});

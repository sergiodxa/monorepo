/**
 * Tests for the SQL script splitter, which must never split on a semicolon that belongs to
 * a string literal, quoted identifier, or comment — the D1 mock uses it to decide what is
 * one statement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { splitSqlStatements } from "./sql-script";

describe("splitSqlStatements", () => {
	test("splits on statement boundaries", () => {
		expect(splitSqlStatements("SELECT 1; SELECT 2")).toEqual(["SELECT 1", "SELECT 2"]);
	});

	test("returns one statement when there is no separator", () => {
		expect(splitSqlStatements("SELECT 1")).toEqual(["SELECT 1"]);
	});

	test("drops a trailing separator and blank fragments", () => {
		expect(splitSqlStatements("SELECT 1;;\n  ; ")).toEqual(["SELECT 1"]);
	});

	test("keeps a semicolon inside a single-quoted literal", () => {
		expect(splitSqlStatements("INSERT INTO t VALUES ('a;b')")).toEqual([
			"INSERT INTO t VALUES ('a;b')",
		]);
	});

	test("keeps a semicolon inside a quoted identifier", () => {
		expect(splitSqlStatements('SELECT "a;b" FROM t')).toEqual(['SELECT "a;b" FROM t']);
	});

	test("keeps a semicolon inside a bracketed identifier", () => {
		expect(splitSqlStatements("SELECT [a;b] FROM t")).toEqual(["SELECT [a;b] FROM t"]);
	});

	test("keeps a semicolon inside a line comment", () => {
		expect(splitSqlStatements("SELECT 1 -- one; two\n")).toEqual(["SELECT 1 -- one; two"]);
	});

	test("keeps a semicolon inside a block comment", () => {
		expect(splitSqlStatements("SELECT /* one; two */ 1")).toEqual(["SELECT /* one; two */ 1"]);
	});

	test("returns nothing for an empty script", () => {
		expect(splitSqlStatements("   \n  ")).toEqual([]);
	});
});

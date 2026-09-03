/**
 * Tests the SQL grammar against the statements this repository's migrations,
 * schemas and analytics queries are actually written as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer.js";

import { sql } from "./sql.js";

/** The runs a rule claimed, with the plain text between them dropped. */
function painted(code: string) {
	return scan(code, sql)
		.filter((token) => token.type !== "plain")
		.map((token) => [token.type, token.value]);
}

describe("sql", () => {
	test("paints a keyword in any casing", () => {
		expect(painted("select from")).toEqual([
			["keyword", "select"],
			["keyword", "from"],
		]);

		expect(painted("SELECT FROM")).toEqual([
			["keyword", "SELECT"],
			["keyword", "FROM"],
		]);
	});

	test("leaves a word that only starts with a keyword alone", () => {
		expect(painted("selected onset")).toEqual([]);
	});

	test("paints a line comment", () => {
		expect(painted("-- src/app/migrations/0003-internal-tenants.sql\nselect")).toEqual([
			["comment", "-- src/app/migrations/0003-internal-tenants.sql"],
			["keyword", "select"],
		]);
	});

	test("paints a block comment across lines", () => {
		expect(painted("/* one\n   two */ select")).toEqual([
			["comment", "/* one\n   two */"],
			["keyword", "select"],
		]);
	});

	test("paints a single-quoted string, doubling to escape", () => {
		expect(painted("where name = 'it''s'")).toEqual([
			["keyword", "where"],
			["operator", "="],
			["string", "'it''s'"],
		]);
	});

	test("keeps two strings on a line apart", () => {
		expect(painted("values ('a', 'b')")).toEqual([
			["keyword", "values"],
			["punctuation", "("],
			["string", "'a'"],
			["punctuation", ","],
			["string", "'b'"],
			["punctuation", ")"],
		]);
	});

	test("paints a delimited identifier as the thing it names", () => {
		expect(painted('select `id`, "name" from `users`')).toEqual([
			["keyword", "select"],
			["class-name", "`id`"],
			["punctuation", ","],
			["class-name", '"name"'],
			["keyword", "from"],
			["class-name", "`users`"],
		]);
	});

	test("paints a type name as a builtin", () => {
		expect(painted("id text(36) not null")).toEqual([
			["builtin", "text"],
			["punctuation", "("],
			["number", "36"],
			["punctuation", ")"],
			["keyword", "not"],
			["keyword", "null"],
		]);
	});

	test("leaves a column whose name starts with a type name alone", () => {
		expect(painted("select blob1, double14 from t")).toEqual([
			["keyword", "select"],
			["punctuation", ","],
			["keyword", "from"],
		]);
	});

	test("paints a call rather than the keyword-shaped name before a paren", () => {
		expect(painted("select count(*), quantileExactWeighted(0.99)(double1)")).toEqual([
			["keyword", "select"],
			["function", "count"],
			["punctuation", "("],
			["operator", "*"],
			["punctuation", "),"],
			["function", "quantileExactWeighted"],
			["punctuation", "("],
			["number", "0.99"],
			["punctuation", ")("],
			["punctuation", ")"],
		]);
	});

	test("keeps a keyword clause from reading as a call", () => {
		expect(painted("where id in (select id from teams)")).toEqual([
			["keyword", "where"],
			["keyword", "in"],
			["punctuation", "("],
			["keyword", "select"],
			["keyword", "from"],
			["punctuation", ")"],
		]);
	});

	test("paints every bind parameter spelling", () => {
		expect(painted("where a = ? and b = :teamId and c = ?1")).toEqual([
			["keyword", "where"],
			["operator", "="],
			["variable", "?"],
			["keyword", "and"],
			["operator", "="],
			["variable", ":teamId"],
			["keyword", "and"],
			["operator", "="],
			["variable", "?1"],
		]);
	});

	test("paints a named constant", () => {
		expect(painted("values (CURRENT_TIMESTAMP)")).toEqual([
			["keyword", "values"],
			["punctuation", "("],
			["constant", "CURRENT_TIMESTAMP"],
			["punctuation", ")"],
		]);
	});

	test("paints a comparison built from more than one character as one operator", () => {
		expect(painted("where a >= ? and b <> ?")).toEqual([
			["keyword", "where"],
			["operator", ">="],
			["variable", "?"],
			["keyword", "and"],
			["operator", "<>"],
			["variable", "?"],
		]);
	});

	/**
	 * Lifted from `docs/adr/uptime/ADR-003-schedule-http-checks-from-next-due-at.md`,
	 * which is the statement the scheduler claims a batch of monitors with.
	 */
	test("scans a real migration document", () => {
		let code = [
			"-- 1. claim: advances the due time and returns only the rows it actually claimed",
			"UPDATE monitors",
			"   SET next_due_at = ?, updated_at = ?",
			" WHERE next_due_at IS NOT NULL AND next_due_at <= ?",
			"RETURNING id AS monitorId, team_id AS teamId;",
			"",
			"-- 2. owners for the claimed teams, indexed point lookups",
			"SELECT id, owner_id FROM teams WHERE id IN (...);",
			"",
		].join("\n");

		let tokens = scan(code, sql);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toContainEqual({
			type: "comment",
			value: "-- 1. claim: advances the due time and returns only the rows it actually claimed",
		});
		expect(tokens).toContainEqual({ type: "keyword", value: "RETURNING" });
		expect(tokens).toContainEqual({ type: "keyword", value: "NOT" });
		expect(tokens).toContainEqual({ type: "keyword", value: "NULL" });
		expect(tokens.filter((token) => token.type === "variable")).toHaveLength(3);
	});

	/** Lifted from `docs/vendor/@remix-run/data-table/README.md`. */
	test("scans a real schema document", () => {
		let code = [
			"create table users (",
			"  id serial primary key,",
			"  email varchar(255) not null unique,",
			"  created_at timestamptz not null default now()",
			");",
			"",
		].join("\n");

		let tokens = scan(code, sql);

		expect(tokens.map((token) => token.value).join("")).toBe(code);

		expect(tokens).toContainEqual({ type: "builtin", value: "serial" });
		expect(tokens).toContainEqual({ type: "builtin", value: "varchar" });
		expect(tokens).toContainEqual({ type: "builtin", value: "timestamptz" });
		expect(tokens).toContainEqual({ type: "function", value: "now" });
	});
});

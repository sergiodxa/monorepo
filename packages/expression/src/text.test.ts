/**
 * The text form: what `parse` builds from what a person types, that `stringify`
 * prints text `parse` reads back to the same JSON for every operator, and that
 * a parse failure names the line and column the text broke at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { createLanguage } from "./language.js";
import { defineOperator } from "./operator.js";

/** A version comparison, standing in for any operator a dialect adds. */
const SEMVER = defineOperator({
	op: "semver",
	args: ["field", "compare", "value"],
	schema: s.object({ compare: s.enum_(["<", ">="]), value: s.string() }),
	test: () => true,
});

/** An operator with an optional trailing argument. */
const NEAR = defineOperator({
	op: "near",
	args: ["field", "lat", "radius"],
	schema: s.object({ lat: s.number(), radius: s.optional(s.number()) }),
	test: () => true,
});

/** An operator taking an object, which the text form writes as a JSON object literal. */
const WEIGHTED = defineOperator({
	op: "weighted",
	args: ["field", "weights"],
	schema: s.object({ weights: s.record(s.string(), s.number()) }),
	test: () => true,
});

/** A dialect with every built-in, references and two added operators. */
const CONDITIONS = createLanguage({ reference: "segment", operators: [SEMVER, NEAR, WEIGHTED] });

describe("parse", () => {
	test("reads comparisons, calls, references and grouping into the JSON form", () => {
		let parsed = CONDITIONS.parse(
			`plan.tier == "pro" and (country in ["AR", "UY"] or segment("internal"))
			 and semver(appVersion, ">=", "2.0.0")`,
		);

		expect(unwrap(parsed)).toEqual({
			op: "all",
			of: [
				{ op: "eq", field: "plan.tier", value: "pro" },
				{
					op: "any",
					of: [
						{ op: "in", field: "country", values: ["AR", "UY"] },
						{ op: "segment", name: "internal" },
					],
				},
				{ op: "semver", field: "appVersion", compare: ">=", value: "2.0.0" },
			],
		});
	});

	test("binds not over and over or", () => {
		expect(unwrap(CONDITIONS.parse("a == 1 or b == 2 and not c == 3"))).toEqual({
			op: "any",
			of: [
				{ op: "eq", field: "a", value: 1 },
				{
					op: "all",
					of: [
						{ op: "eq", field: "b", value: 2 },
						{ op: "not", of: { op: "eq", field: "c", value: 3 } },
					],
				},
			],
		});
	});

	test("keeps a parenthesized chain as its own node", () => {
		expect(unwrap(CONDITIONS.parse("a == 1 and (b == 2 and c == 3)"))).toEqual({
			op: "all",
			of: [
				{ op: "eq", field: "a", value: 1 },
				{
					op: "all",
					of: [
						{ op: "eq", field: "b", value: 2 },
						{ op: "eq", field: "c", value: 3 },
					],
				},
			],
		});
	});

	test.each<[string, string, unknown]>([
		["true", "true", { op: "always" }],
		["!=", 'country != "AR"', { op: "ne", field: "country", value: "AR" }],
		["<", "seats < 10", { op: "lt", field: "seats", value: 10 }],
		["<=", "seats <= 1.5e1", { op: "lte", field: "seats", value: 15 }],
		[">", "seats > -1", { op: "gt", field: "seats", value: -1 }],
		[">=", "seats >= 0", { op: "gte", field: "seats", value: 0 }],
		[
			"not in",
			"country not in [null, true]",
			{ op: "notIn", field: "country", values: [null, true] },
		],
		["exists", "exists(beta)", { op: "exists", field: "beta" }],
		[
			"matches",
			'matches(email, "@acme\\\\.com$")',
			{ op: "matches", field: "email", pattern: "@acme\\.com$" },
		],
		["an array index", 'roles.0 == "admin"', { op: "eq", field: "roles.0", value: "admin" }],
		["a quoted path", '`user-agent` == "bot"', { op: "eq", field: "user-agent", value: "bot" }],
		["a keyword quoted as a path", "exists(`not`)", { op: "exists", field: "not" }],
		["all in call form", "all()", { op: "all", of: [] }],
		["any in call form", "any(true)", { op: "any", of: [{ op: "always" }] }],
		["an omitted optional argument", "near(home, 1)", { op: "near", field: "home", lat: 1 }],
	])("reads %s", (_, text, expected) => {
		expect(unwrap(CONDITIONS.parse(text))).toEqual(expected);
	});
});

describe("stringify", () => {
	test("prints the canonical text for a nested expression", () => {
		let expression: typeof CONDITIONS.Expression = {
			op: "any",
			of: [
				{ op: "segment", name: "internal" },
				{ op: "semver", field: "appVersion", compare: ">=", value: "2.0.0" },
			],
		};

		expect(CONDITIONS.stringify(expression)).toBe(
			'segment("internal") or semver(appVersion, ">=", "2.0.0")',
		);
	});

	test.each<[string]>([
		["true"],
		['plan.tier == "pro"'],
		['country != "AR"'],
		['country in ["AR", "UY"]'],
		["country not in [null, 1, false]"],
		["seats < 10"],
		["seats <= 10"],
		["seats > 1.5"],
		["seats >= 0"],
		['startsWith(email, "ada")'],
		['endsWith(email, "@acme.com")'],
		['contains(email, "+")'],
		['matches(email, "^a\\\\d+$")'],
		["exists(beta)"],
		['segment("internal")'],
		['semver(appVersion, "<", "2.0.0")'],
		["near(home, 1.5, 3)"],
		["near(home, 1.5)"],
		["not exists(beta)"],
		["not (a == 1 and b == 2)"],
		["not not true"],
		["a == 1 and b == 2 and c == 3"],
		["a == 1 or b == 2 and c == 3"],
		["(a == 1 or b == 2) and c == 3"],
		["a == 1 and (b == 2 and c == 3)"],
		["a == 1 or (b == 2 or c == 3)"],
		["all()"],
		["all(true)"],
		["any()"],
		["any(a == 1 or b == 2)"],
		['`user-agent` == "bot"'],
		['`in` == "x"'],
		['`back\\`tick` == "x"'],
		['eq == "x"'],
		['weighted(arm, {"on": 1, "off": 3})'],
		["weighted(arm, {})"],
	])("round-trips %s", (text) => {
		let parsed = unwrap(CONDITIONS.parse(text));

		expect(CONDITIONS.stringify(parsed)).toBe(text);
		expect(unwrap(CONDITIONS.parse(CONDITIONS.stringify(parsed)))).toEqual(parsed);
	});
});

describe("parse failures", () => {
	test.each<[string, string, number, number, string | RegExp]>([
		["a dangling and", 'plan.tier == "pro" and', 1, 23, "Expected a condition after 'and'"],
		["an empty text", "", 1, 1, "Expected a condition"],
		["a missing comparison", "plan.tier", 1, 10, "Expected a comparison after 'plan.tier'"],
		["a missing value", "plan.tier ==", 1, 13, "Expected a value after '=='"],
		["an unclosed group", "(a == 1", 1, 8, "Expected ')' but found the end"],
		["text left over", "a == 1 b == 2", 1, 8, "Unexpected 'b'"],
		["an unknown character", "a == 1 && b == 2", 1, 8, "Unexpected character '&'"],
		["an unknown call", 'regex(email, "a")', 1, 1, '"regex" is not an operator of this language'],
		[
			"a call without a field",
			'exists("beta")',
			1,
			8,
			'Expected a field path as the first argument of "exists"',
		],
		[
			"too many arguments",
			'semver(v, ">=", "1.0.0", 2)',
			1,
			24,
			'"semver" takes at most 3 arguments',
		],
		["a value of the wrong type", 'seats < "10"', 1, 9, /number/i],
		["an argument outside its enum", 'semver(v, "~", "1.0.0")', 1, 11, /./],
		["an object key left unquoted", "weighted(arm, {on: 1})", 1, 16, "Expected a quoted key"],
		["a failure on a later line", 'a == 1 and\n  b < "x"', 2, 7, /number/i],
	])("refuses %s at its line and column", (_, text, line, column, message) => {
		let parsed = CONDITIONS.parse(text);

		expect(parsed).toMatchObject({ status: "failure", error: { line, column } });
		expect(parsed.status === "failure" && parsed.error.message).toMatch(message);
	});

	test("refuses the operators a restricted dialect leaves out", () => {
		let rules = createLanguage({ builtins: ["all", "any", "not", "contains"] });

		expect(
			unwrap(rules.parse(`contains(title, "sponsored") and not contains(author, "staff")`)),
		).toEqual({
			op: "all",
			of: [
				{ op: "contains", field: "title", value: "sponsored" },
				{ op: "not", of: { op: "contains", field: "author", value: "staff" } },
			],
		});
		expect(rules.parse('matches(title, "a+")')).toMatchObject({
			error: { message: '"matches" is not an operator of this language', column: 1 },
		});
		expect(rules.parse('title == "x"')).toMatchObject({
			error: { message: '"==" is not an operator of this language', column: 7 },
		});
		expect(rules.parse("true")).toMatchObject({
			error: { message: '"true" is not an operator of this language' },
		});
		expect(createLanguage({ builtins: ["eq"] }).parse("a == 1 or b == 2")).toMatchObject({
			error: { message: '"or" is not an operator of this language', column: 8 },
		});
	});
});

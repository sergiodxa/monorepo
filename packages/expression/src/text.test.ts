/**
 * The text form: what `parse` builds from what a person types, that `stringify`
 * prints text `parse` reads back to the same JSON for every operator, with a
 * literal and with a path, and that a parse failure names the line and column
 * the text broke at.
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
			`ctx.plan.tier == "pro" and (ctx.country in ["AR", "UY"] or segment("internal"))
			 and semver(ctx.appVersion, ">=", "2.0.0")`,
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
		expect(unwrap(CONDITIONS.parse("ctx.a == 1 or ctx.b == 2 and not ctx.c == 3"))).toEqual({
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
		expect(unwrap(CONDITIONS.parse("ctx.a == 1 and (ctx.b == 2 and ctx.c == 3)"))).toEqual({
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
		["!=", 'ctx.country != "AR"', { op: "ne", field: "country", value: "AR" }],
		["<", "ctx.seats < 10", { op: "lt", field: "seats", value: 10 }],
		["<=", "ctx.seats <= 1.5e1", { op: "lte", field: "seats", value: 15 }],
		[">", "ctx.seats > -1", { op: "gt", field: "seats", value: -1 }],
		[">=", "ctx.seats >= 0", { op: "gte", field: "seats", value: 0 }],
		[
			"not in",
			"ctx.country not in [null, true]",
			{ op: "notIn", field: "country", values: [null, true] },
		],
		["exists", "exists(ctx.beta)", { op: "exists", field: "beta" }],
		[
			"matches",
			'matches(ctx.email, "@acme\\\\.com$")',
			{ op: "matches", field: "email", pattern: "@acme\\.com$" },
		],
		["an array index", 'ctx.roles.0 == "admin"', { op: "eq", field: "roles.0", value: "admin" }],
		[
			"a quoted segment",
			'ctx.headers.`user-agent` == "bot"',
			{ op: "eq", field: "headers.user-agent", value: "bot" },
		],
		["a keyword as a segment", "exists(ctx.not.in)", { op: "exists", field: "not.in" }],
		["a field named ctx", "exists(ctx.ctx)", { op: "exists", field: "ctx" }],
		["all in call form", "all()", { op: "all", of: [] }],
		["any in call form", "any(true)", { op: "any", of: [{ op: "always" }] }],
		["an omitted optional argument", "near(ctx.home, 1)", { op: "near", field: "home", lat: 1 }],
		[
			"a path on the right of ==",
			"ctx.article.authorId == ctx.actor.id",
			{ op: "eq", field: "article.authorId", path: "actor.id" },
		],
		[
			"a path on the right of in",
			"ctx.article.teamId in ctx.actor.teamIds",
			{ op: "in", field: "article.teamId", path: "actor.teamIds" },
		],
		[
			"a path on the right of not in",
			"ctx.a not in ctx.blocked",
			{ op: "notIn", field: "a", path: "blocked" },
		],
		[
			"a path in a call's right-hand position",
			"includes(ctx.list, ctx.x)",
			{ op: "includes", field: "list", path: "x" },
		],
		[
			"a literal in a call's right-hand position",
			'includes(ctx.billing.features, "reports")',
			{ op: "includes", field: "billing.features", value: "reports" },
		],
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
			'segment("internal") or semver(ctx.appVersion, ">=", "2.0.0")',
		);
	});

	test("prints a path node under ctx. on both sides", () => {
		expect(CONDITIONS.stringify({ op: "eq", field: "a.b", path: "c.0" })).toBe(
			"ctx.a.b == ctx.c.0",
		);
		expect(CONDITIONS.stringify({ op: "subsetOf", field: "a", path: "b" })).toBe(
			"subsetOf(ctx.a, ctx.b)",
		);
	});

	test.each<[string]>([
		["true"],
		['ctx.plan.tier == "pro"'],
		["ctx.plan.tier == ctx.default.tier"],
		['ctx.country != "AR"'],
		["ctx.country != ctx.home"],
		['ctx.country in ["AR", "UY"]'],
		["ctx.country in ctx.allowed"],
		["ctx.country not in [null, 1, false]"],
		["ctx.country not in ctx.blocked"],
		["ctx.seats < 10"],
		["ctx.seats < ctx.limit"],
		["ctx.seats <= 10"],
		["ctx.seats <= ctx.limit"],
		["ctx.seats > 1.5"],
		["ctx.seats > ctx.limit"],
		["ctx.seats >= 0"],
		["ctx.seats >= ctx.limit"],
		['includes(ctx.features, "reports")'],
		["includes(ctx.features, ctx.feature)"],
		['intersects(ctx.teamIds, ["t_1", "t_2"])'],
		["intersects(ctx.teamIds, ctx.actor.teamIds)"],
		['subsetOf(ctx.scopes, ["read"])'],
		["subsetOf(ctx.scopes, ctx.actor.scopes)"],
		['startsWith(ctx.email, "ada")'],
		['endsWith(ctx.email, "@acme.com")'],
		['contains(ctx.email, "+")'],
		['matches(ctx.email, "^a\\\\d+$")'],
		["exists(ctx.beta)"],
		['segment("internal")'],
		['semver(ctx.appVersion, "<", "2.0.0")'],
		["near(ctx.home, 1.5, 3)"],
		["near(ctx.home, 1.5)"],
		["not exists(ctx.beta)"],
		["not (ctx.a == 1 and ctx.b == 2)"],
		["not not true"],
		["ctx.a == 1 and ctx.b == 2 and ctx.c == 3"],
		["ctx.a == 1 or ctx.b == 2 and ctx.c == 3"],
		["(ctx.a == 1 or ctx.b == 2) and ctx.c == 3"],
		["ctx.a == 1 and (ctx.b == 2 and ctx.c == 3)"],
		["ctx.a == 1 or (ctx.b == 2 or ctx.c == 3)"],
		["all()"],
		["all(true)"],
		["any()"],
		["any(ctx.a == 1 or ctx.b == 2)"],
		['ctx.headers.`user-agent` == "bot"'],
		['ctx.a.`` == "x"'],
		['ctx.in == "x"'],
		['ctx.`back\\`tick` == "x"'],
		['ctx.eq == "x"'],
		['ctx.ctx == "x"'],
		['weighted(ctx.arm, {"on": 1, "off": 3})'],
		["weighted(ctx.arm, {})"],
	])("round-trips %s", (text) => {
		let parsed = unwrap(CONDITIONS.parse(text));

		expect(CONDITIONS.stringify(parsed)).toBe(text);
		expect(unwrap(CONDITIONS.parse(CONDITIONS.stringify(parsed)))).toEqual(parsed);
	});
});

describe("parse failures", () => {
	test.each<[string, string, number, number, string | RegExp]>([
		["a dangling and", 'ctx.plan.tier == "pro" and', 1, 27, "Expected a condition after 'and'"],
		["an empty text", "", 1, 1, "Expected a condition"],
		["a missing comparison", "ctx.plan.tier", 1, 14, "Expected a comparison after 'ctx.plan.tier'"],
		["a missing value", "ctx.plan.tier ==", 1, 17, "Expected a value after '=='"],
		["an unclosed group", "(ctx.a == 1", 1, 12, "Expected ')' but found the end"],
		["text left over", "ctx.a == 1 ctx.b == 2", 1, 12, "Unexpected 'ctx.b'"],
		["an unknown character", "ctx.a == 1 && ctx.b == 2", 1, 12, "Unexpected character '&'"],
		[
			"an unknown call",
			'regex(ctx.email, "a")',
			1,
			1,
			'"regex" is not an operator of this language',
		],
		[
			"a call without a field",
			'exists("beta")',
			1,
			8,
			`Expected a path starting with 'ctx.' as the first argument of "exists"`,
		],
		[
			"too many arguments",
			'semver(ctx.v, ">=", "1.0.0", 2)',
			1,
			28,
			'"semver" takes at most 3 arguments',
		],
		["a value of the wrong type", 'ctx.seats < "10"', 1, 13, /number/i],
		["an argument outside its enum", 'semver(ctx.v, "~", "1.0.0")', 1, 15, /./],
		["an object key left unquoted", "weighted(ctx.arm, {on: 1})", 1, 20, "Expected a quoted key"],
		["a failure on a later line", 'ctx.a == 1 and\n  ctx.b < "x"', 2, 11, /number/i],
		[
			"a path without ctx.",
			'plan.tier == "pro"',
			1,
			1,
			"Paths start with 'ctx.': write 'ctx.plan.tier'",
		],
		["a quoted path without ctx.", '`user-agent` == "bot"', 1, 1, "write 'ctx.`user-agent`'"],
		["a call argument without ctx.", "exists(beta)", 1, 8, "write 'ctx.beta'"],
		["a right-hand path without ctx.", "ctx.a == b", 1, 10, "write 'ctx.b'"],
		["ctx alone", "ctx == 1", 1, 1, "Expected '.' and a field after 'ctx'"],
		["ctx alone in a call", "exists(ctx)", 1, 8, "Expected '.' and a field after 'ctx'"],
		["ctx with a dangling dot", "ctx. == 1", 1, 5, "Expected a field after 'ctx.'"],
		["a literal on the left", "1 < ctx.x", 1, 1, "Expected a condition"],
		[
			"a quoted segment holding a dot",
			'ctx.`a.b` == "x"',
			1,
			5,
			"A quoted segment cannot hold '.'",
		],
		[
			"a path where an extension takes a literal",
			'semver(ctx.v, ">=", ctx.min)',
			1,
			21,
			'"semver" takes a literal as "value", where a path was written',
		],
		[
			"a path in a built-in's non-comparison argument",
			"startsWith(ctx.email, ctx.prefix)",
			1,
			23,
			'"startsWith" takes a literal as "value"',
		],
	])("refuses %s at its line and column", (_, text, line, column, message) => {
		let parsed = CONDITIONS.parse(text);

		expect(parsed).toMatchObject({ status: "failure", error: { line, column } });
		expect(parsed.status === "failure" && parsed.error.message).toMatch(message);
	});

	test.each([
		["an unclosed string of escaped quotes", `ctx.a == "${'\\"'.repeat(50_000)}`, 10],
		["an unclosed quoted name of escaped backticks", `\`${"\\`[".repeat(50_000)}`, 1],
		["an unclosed quoted segment of escaped backticks", `ctx.a.\`${"\\`[".repeat(50_000)}`, 6],
	])("refuses %s in linear time", (_, text, column) => {
		let started = performance.now();
		let parsed = CONDITIONS.parse(text);

		expect(parsed).toMatchObject({ status: "failure", error: { line: 1, column } });
		expect(performance.now() - started).toBeLessThan(1_000);
	});

	test("refuses the operators a restricted dialect leaves out", () => {
		let rules = createLanguage({ builtins: ["all", "any", "not", "contains"] });

		expect(
			unwrap(rules.parse(`contains(ctx.title, "sponsored") and not contains(ctx.author, "staff")`)),
		).toEqual({
			op: "all",
			of: [
				{ op: "contains", field: "title", value: "sponsored" },
				{ op: "not", of: { op: "contains", field: "author", value: "staff" } },
			],
		});
		expect(rules.parse('matches(ctx.title, "a+")')).toMatchObject({
			error: { message: '"matches" is not an operator of this language', column: 1 },
		});
		expect(rules.parse('ctx.title == "x"')).toMatchObject({
			error: { message: '"==" is not an operator of this language', column: 11 },
		});
		expect(rules.parse("true")).toMatchObject({
			error: { message: '"true" is not an operator of this language' },
		});
		expect(createLanguage({ builtins: ["eq"] }).parse("ctx.a == 1 or ctx.b == 2")).toMatchObject({
			error: { message: '"or" is not an operator of this language', column: 12 },
		});
	});
});

describe("names", () => {
	test.each(["ctx", "and", "or", "not", "in", "true", "false", "null"])(
		"refuses an operator or a reference named %s",
		(name) => {
			let operator = defineOperator({
				op: name,
				args: ["field"],
				schema: s.object({}),
				test: () => true,
			});

			expect(() => createLanguage({ operators: [operator] })).toThrow(TypeError);
			expect(() => createLanguage({ reference: name })).toThrow(/keyword/);
		},
	);
});

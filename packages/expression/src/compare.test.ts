/**
 * Comparisons whose right-hand side is another context path, and the list
 * operators: what each answers when either side is missing, `null`, of the
 * wrong type or a `Date`, and how the JSON form keeps a literal and a path apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { createLanguage } from "./language.js";
import { defineOperator } from "./operator.js";

/** Every built-in, so each comparison is reachable. */
const RULES = createLanguage();

/** A context carrying both sides of every comparison the tables run. */
const CONTEXT = {
	article: {
		authorId: "u_1",
		teamId: "t_1",
		teamIds: ["t_1", "t_2"],
		requiredLevel: 3,
		publishedAt: new Date("2026-01-01T00:00:00.000Z"),
		ownerId: null,
		scopes: ["read"],
	},
	actor: {
		id: "u_1",
		level: 5,
		teamIds: ["t_2", "t_3"],
		scopes: ["read", "write"],
		seenAt: new Date("2026-01-01T00:00:00.000Z"),
		since: new Date("2025-01-01T00:00:00.000Z"),
		managerId: null,
		blocked: "nobody",
	},
};

/** Compiles and evaluates in one step, failing the test when compiling fails. */
function holds(expression: unknown, context: object = CONTEXT): boolean {
	return RULES.evaluate(unwrap(RULES.compile(expression)), context);
}

describe("path comparisons", () => {
	test.each<[string, unknown, boolean]>([
		["eq between equal paths", { op: "eq", field: "article.authorId", path: "actor.id" }, true],
		["eq between different paths", { op: "eq", field: "article.teamId", path: "actor.id" }, false],
		["ne between different paths", { op: "ne", field: "article.teamId", path: "actor.id" }, true],
		["ne between equal paths", { op: "ne", field: "article.authorId", path: "actor.id" }, false],
		["in a list path", { op: "in", field: "article.teamId", path: "article.teamIds" }, true],
		[
			"in a list path lacking it",
			{ op: "in", field: "article.teamId", path: "actor.teamIds" },
			false,
		],
		[
			"notIn a list path lacking it",
			{ op: "notIn", field: "article.teamId", path: "actor.teamIds" },
			true,
		],
		[
			"notIn a list path holding it",
			{ op: "notIn", field: "article.teamId", path: "article.teamIds" },
			false,
		],
		[
			"gte against a smaller number",
			{ op: "gte", field: "actor.level", path: "article.requiredLevel" },
			true,
		],
		[
			"lt against a smaller number",
			{ op: "lt", field: "actor.level", path: "article.requiredLevel" },
			false,
		],
		[
			"eq between Dates at one time",
			{ op: "eq", field: "article.publishedAt", path: "actor.seenAt" },
			true,
		],
		[
			"ne between Dates at one time",
			{ op: "ne", field: "article.publishedAt", path: "actor.seenAt" },
			false,
		],
		["gt between ordered Dates", { op: "gt", field: "actor.seenAt", path: "actor.since" }, true],
		["lte between ordered Dates", { op: "lte", field: "actor.seenAt", path: "actor.since" }, false],
	])("answers %s", (_, expression, expected) => {
		expect(holds(expression)).toBe(expected);
	});

	test.each<[string, string, string]>([
		["the field", "article.missing", "actor.id"],
		["the path", "article.authorId", "actor.missing"],
		["both sides", "article.missing", "actor.missing"],
	])("answers false for every comparison when %s is missing", (_, field, path) => {
		for (let op of ["eq", "ne", "in", "notIn", "lt", "lte", "gt", "gte"]) {
			expect(holds({ op, field, path }), op).toBe(false);
		}
	});

	test("never matches null across two paths, on either side", () => {
		for (let op of ["eq", "ne", "in", "notIn", "lt", "gte"]) {
			expect(holds({ op, field: "article.ownerId", path: "actor.managerId" }), op).toBe(false);
			expect(holds({ op, field: "article.ownerId", path: "actor.id" }), op).toBe(false);
			expect(holds({ op, field: "actor.id", path: "article.ownerId" }), op).toBe(false);
		}
	});

	test("compares a literal null as written", () => {
		expect(holds({ op: "eq", field: "article.ownerId", value: null })).toBe(true);
		expect(holds({ op: "ne", field: "article.ownerId", value: null })).toBe(false);
	});

	test.each<[string, unknown]>([
		["eq between a string and a number", { op: "eq", field: "actor.id", path: "actor.level" }],
		["ne between a string and a number", { op: "ne", field: "actor.id", path: "actor.level" }],
		["eq between a Date and a number", { op: "eq", field: "actor.seenAt", path: "actor.level" }],
		["lt between a Date and a number", { op: "lt", field: "actor.seenAt", path: "actor.level" }],
		["gt on strings", { op: "gt", field: "actor.id", path: "article.teamId" }],
		["eq against a list", { op: "eq", field: "actor.id", path: "actor.teamIds" }],
		["in against a non-list", { op: "in", field: "actor.id", path: "actor.blocked" }],
		["notIn against a non-list", { op: "notIn", field: "actor.id", path: "actor.blocked" }],
		["in with a list as the needle", { op: "in", field: "actor.teamIds", path: "actor.teamIds" }],
	])("answers false for a type mismatch: %s", (_, expression) => {
		expect(holds(expression)).toBe(false);
	});

	test("keeps a path on an extension node the operator's own field", () => {
		let named = defineOperator({
			op: "named",
			args: ["field", "path"],
			schema: s.object({ path: s.string() }),
			test: (value, node) => value === node.path,
		});
		let language = createLanguage({ operators: [named] });
		let compiled = unwrap(language.compile({ op: "named", field: "a", path: "b" }));

		expect(language.evaluate(compiled, { a: "b", b: "a" })).toBe(true);
	});

	test("reads a path in place of the built-in an extension replaced", () => {
		let eq = defineOperator({
			op: "eq",
			args: ["field", "value"],
			schema: s.object({ value: s.string() }),
			test: (value, node) => value === node.value.toUpperCase(),
		});
		let language = createLanguage({ operators: [eq] });

		expect(language.compile({ op: "eq", field: "a", path: "b" })).toMatchObject({
			status: "failure",
			error: { path: "value" },
		});
	});
});

describe("the JSON form of a right-hand side", () => {
	test.each<[string, unknown, string, string]>([
		["both a value and a path", { op: "eq", field: "a", value: 1, path: "b" }, "path", "not both"],
		["neither a value nor a path", { op: "eq", field: "a" }, "value", 'Expected "value" or "path"'],
		["both values and a path", { op: "in", field: "a", values: [], path: "b" }, "path", "not both"],
		["neither values nor a path", { op: "subsetOf", field: "a" }, "values", '"values" or "path"'],
		["an empty path", { op: "eq", field: "a", path: "" }, "path", "Expected a context field"],
		["a path that is no string", { op: "lt", field: "a", path: 1 }, "path", ""],
		[
			"a path under a nested node",
			{ op: "not", of: { op: "eq", field: "a", path: 2 } },
			"of.path",
			"",
		],
	])("refuses %s", (_, expression, path, message) => {
		let compiled = RULES.compile(expression);

		expect(compiled).toMatchObject({ status: "failure", error: { path } });
		expect(compiled.status === "failure" && compiled.error.message).toContain(message);
		expect(s.parseSafe(RULES.schema, expression).success).toBe(false);
	});

	test("keeps a path through validation", () => {
		let expression = { op: "gte", field: "actor.level", path: "article.requiredLevel" };

		expect(unwrap(RULES.compile(expression))).toEqual(expression);
	});
});

describe("list operators", () => {
	let lists = {
		features: ["reports", "export"],
		ancestorIds: ["f_1", "f_2"],
		rootFolderId: "f_2",
		teamIds: ["t_1"],
		otherTeamIds: ["t_2"],
		scopes: ["read"],
		granted: ["read", "write"],
		empty: [],
		count: 2,
		seen: [new Date("2026-01-01T00:00:00.000Z")],
		at: new Date("2026-01-01T00:00:00.000Z"),
		mixed: [1, "1", true],
	};

	test.each<[string, unknown, boolean]>([
		["includes a literal member", { op: "includes", field: "features", value: "reports" }, true],
		["includes a literal non-member", { op: "includes", field: "features", value: "audit" }, false],
		[
			"includes a member by path",
			{ op: "includes", field: "ancestorIds", path: "rootFolderId" },
			true,
		],
		["includes a Date by time value", { op: "includes", field: "seen", path: "at" }, true],
		["includes within one type", { op: "includes", field: "mixed", value: false }, false],
		["includes a number among mixed types", { op: "includes", field: "mixed", value: 1 }, true],
		["intersects sharing a member", { op: "intersects", field: "scopes", path: "granted" }, true],
		[
			"intersects sharing none",
			{ op: "intersects", field: "teamIds", path: "otherTeamIds" },
			false,
		],
		[
			"intersects a literal list",
			{ op: "intersects", field: "teamIds", values: ["t_1", "t_9"] },
			true,
		],
		["intersects from an empty list", { op: "intersects", field: "empty", path: "granted" }, false],
		["subsetOf a wider list", { op: "subsetOf", field: "scopes", path: "granted" }, true],
		["subsetOf a narrower list", { op: "subsetOf", field: "granted", path: "scopes" }, false],
		["subsetOf from an empty list", { op: "subsetOf", field: "empty", values: [] }, true],
		["subsetOf a literal list", { op: "subsetOf", field: "scopes", values: ["read"] }, true],
	])("answers %s", (_, expression, expected) => {
		expect(holds(expression, lists)).toBe(expected);
	});

	test.each<[string, unknown]>([
		["includes on a non-list field", { op: "includes", field: "count", value: 2 }],
		["includes with a list as the value", { op: "includes", field: "features", path: "teamIds" }],
		["intersects on a non-list field", { op: "intersects", field: "count", path: "granted" }],
		["intersects against a non-list", { op: "intersects", field: "scopes", path: "count" }],
		["subsetOf on a non-list field", { op: "subsetOf", field: "count", values: [2] }],
		["subsetOf against a non-list", { op: "subsetOf", field: "empty", path: "count" }],
		["includes on a missing field", { op: "includes", field: "nothing", value: "a" }],
		["intersects against a missing list", { op: "intersects", field: "scopes", path: "nothing" }],
	])("answers false for %s", (_, expression) => {
		expect(holds(expression, lists)).toBe(false);
	});

	test("asks the question in from the other side", () => {
		let context = { list: ["a", "b"], x: "b" };

		expect(holds({ op: "in", field: "x", path: "list" }, context)).toBe(true);
		expect(holds({ op: "includes", field: "list", path: "x" }, context)).toBe(true);
	});
});

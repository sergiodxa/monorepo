/**
 * One row per operator, and the three things a targeting language has to get
 * right beyond them: a field the caller did not send matches nothing, a
 * comparison never coerces across types, and the composing operators nest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EvaluationContext } from "@sdxc/flags";

import { expect, test } from "vitest";

import type { CompiledCondition } from "../snapshot.js";

import { matchesCondition } from "./condition.js";

/** One context carrying a field of every shape the table compares against. */
const CONTEXT: EvaluationContext = {
	targetingKey: "user-42",
	country: "AR",
	email: "sergio@example.com",
	seats: 5,
	beta: true,
	version: "1.4.2",
	build: "nightly",
	plan: { tier: "pro" },
	roles: ["admin", "billing"],
	deletedAt: null,
};

/** Compiled the way the parser compiles a pattern, which is the only form evaluation sees. */
function pattern(source: string): RegExp {
	return new RegExp(source, "v");
}

test.each<[string, CompiledCondition, boolean]>([
	["always, which every subject satisfies", { op: "always" }, true],

	["eq on a field holding that value", { op: "eq", field: "country", value: "AR" }, true],
	["eq on a field holding another value", { op: "eq", field: "country", value: "US" }, false],
	["eq on a nested field", { op: "eq", field: "plan.tier", value: "pro" }, true],
	["eq against null on a field holding null", { op: "eq", field: "deletedAt", value: null }, true],

	["ne on a field holding another value", { op: "ne", field: "country", value: "US" }, true],
	["ne on a field holding that value", { op: "ne", field: "country", value: "AR" }, false],

	["in on a field among the values", { op: "in", field: "country", values: ["AR", "UY"] }, true],
	["in on a field outside them", { op: "in", field: "country", values: ["US", "CA"] }, false],

	["notIn on a field outside the values", { op: "notIn", field: "country", values: ["US"] }, true],
	["notIn on a field among them", { op: "notIn", field: "country", values: ["AR"] }, false],

	["lt under the bound", { op: "lt", field: "seats", value: 10 }, true],
	["lt at the bound", { op: "lt", field: "seats", value: 5 }, false],
	["lte at the bound", { op: "lte", field: "seats", value: 5 }, true],
	["gt over the bound", { op: "gt", field: "seats", value: 1 }, true],
	["gt at the bound", { op: "gt", field: "seats", value: 5 }, false],
	["gte at the bound", { op: "gte", field: "seats", value: 5 }, true],

	["startsWith on a matching prefix", { op: "startsWith", field: "email", value: "sergio" }, true],
	["startsWith on another prefix", { op: "startsWith", field: "email", value: "ana" }, false],
	["endsWith on a matching suffix", { op: "endsWith", field: "email", value: "example.com" }, true],
	["endsWith on another suffix", { op: "endsWith", field: "email", value: ".org" }, false],
	["contains on an inner substring", { op: "contains", field: "email", value: "@example" }, true],
	["contains on absent text", { op: "contains", field: "email", value: "@acme" }, false],

	[
		"matches on a pattern that hits",
		{ op: "matches", field: "email", pattern: pattern("@example\\.") },
		true,
	],
	[
		"matches on a pattern that misses",
		{ op: "matches", field: "email", pattern: pattern("^ana") },
		false,
	],

	[
		"semver over the version",
		{ op: "semver", field: "version", compare: ">=", value: "1.0.0" },
		true,
	],
	["semver under it", { op: "semver", field: "version", compare: "<", value: "1.0.0" }, false],
	["semver within a minor", { op: "semver", field: "version", compare: "~", value: "1.4.0" }, true],
	[
		"semver on a field that is no version",
		{ op: "semver", field: "build", compare: ">=", value: "1.0.0" },
		false,
	],

	["exists on a field that is there", { op: "exists", field: "country" }, true],
	["exists on a field holding null", { op: "exists", field: "deletedAt" }, true],
	["exists on a field that is not", { op: "exists", field: "city" }, false],

	[
		"all when every member holds",
		{ op: "all", of: [{ op: "always" }, { op: "exists", field: "country" }] },
		true,
	],
	[
		"all when one member fails",
		{ op: "all", of: [{ op: "always" }, { op: "exists", field: "city" }] },
		false,
	],
	["all of nothing", { op: "all", of: [] }, true],
	[
		"any when one member holds",
		{ op: "any", of: [{ op: "exists", field: "city" }, { op: "always" }] },
		true,
	],
	["any when none do", { op: "any", of: [{ op: "exists", field: "city" }] }, false],
	["any of nothing", { op: "any", of: [] }, false],
	["not over a condition that holds", { op: "not", of: { op: "always" } }, false],
	["not over one that does not", { op: "not", of: { op: "exists", field: "city" } }, true],

	[
		"segment, which stands for the condition it carries",
		{
			op: "segment",
			name: "internal",
			of: { op: "endsWith", field: "email", value: "example.com" },
		},
		true,
	],
])("matches %s", (_, condition, expected) => {
	expect(matchesCondition(condition, CONTEXT)).toBe(expected);
});

test.each<[string, CompiledCondition]>([
	["eq", { op: "eq", field: "city", value: "Buenos Aires" }],
	["ne", { op: "ne", field: "city", value: "Buenos Aires" }],
	["in", { op: "in", field: "city", values: ["Buenos Aires"] }],
	["notIn", { op: "notIn", field: "city", values: ["Buenos Aires"] }],
	["lt", { op: "lt", field: "quota", value: 10 }],
	["lte", { op: "lte", field: "quota", value: 10 }],
	["gt", { op: "gt", field: "quota", value: 10 }],
	["gte", { op: "gte", field: "quota", value: 10 }],
	["startsWith", { op: "startsWith", field: "city", value: "B" }],
	["endsWith", { op: "endsWith", field: "city", value: "s" }],
	["contains", { op: "contains", field: "city", value: "n" }],
	["matches", { op: "matches", field: "city", pattern: pattern(".?") }],
	["semver", { op: "semver", field: "release", compare: ">=", value: "1.0.0" }],
])("holds for nobody when %s names a field the context lacks", (_, condition) => {
	expect(matchesCondition(condition, CONTEXT)).toBe(false);
});

test("keeps a rule about a field the caller did not send off every request", () => {
	let outsideEU: CompiledCondition = { op: "notIn", field: "country", values: ["DE", "FR"] };

	expect(matchesCondition(outsideEU, { targetingKey: "user-42" })).toBe(false);
	expect(matchesCondition(outsideEU, CONTEXT)).toBe(true);
});

test("negates an absent field, which is the one way a rule reaches a caller that sent none", () => {
	let missing: CompiledCondition = { op: "not", of: { op: "exists", field: "city" } };

	expect(matchesCondition(missing, CONTEXT)).toBe(true);
});

test.each<[string, CompiledCondition]>([
	["a number against a string field", { op: "eq", field: "seats", value: "5" }],
	["a string against a number field", { op: "eq", field: "country", value: 5 }],
	["a boolean against a string field", { op: "eq", field: "country", value: true }],
	["a list of another type", { op: "in", field: "seats", values: ["5"] }],
	["an ordering against a string field", { op: "lt", field: "country", value: 10 }],
	["an ordering against a boolean field", { op: "gt", field: "beta", value: 0 }],
	["text against a number field", { op: "contains", field: "seats", value: "5" }],
	["a pattern against a structure", { op: "matches", field: "plan", pattern: pattern("pro") }],
	["a version against a list", { op: "semver", field: "roles", compare: ">=", value: "1.0.0" }],
])("compares within one type, so %s holds for nobody", (_, condition) => {
	expect(matchesCondition(condition, CONTEXT)).toBe(false);
});

test("reports inequality for a field holding another type than the value", () => {
	expect(matchesCondition({ op: "ne", field: "seats", value: "5" }, CONTEXT)).toBe(true);
	expect(matchesCondition({ op: "notIn", field: "seats", values: ["5"] }, CONTEXT)).toBe(true);
});

test("nests the composing operators to any depth", () => {
	let condition: CompiledCondition = {
		op: "all",
		of: [
			{
				op: "any",
				of: [
					{ op: "eq", field: "country", value: "AR" },
					{ op: "eq", field: "country", value: "UY" },
				],
			},
			{ op: "not", of: { op: "any", of: [{ op: "eq", field: "plan.tier", value: "free" }] } },
			{ op: "segment", name: "beta", of: { op: "eq", field: "beta", value: true } },
		],
	};

	expect(matchesCondition(condition, CONTEXT)).toBe(true);
	expect(matchesCondition(condition, { ...CONTEXT, plan: { tier: "free" } })).toBe(false);
	expect(matchesCondition(condition, { ...CONTEXT, country: "US" })).toBe(false);
});

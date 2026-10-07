/**
 * The expression types a language derives from its configuration, checked by
 * the type checker: the built-ins it keeps, the reference spelling it chose,
 * and the operators it added, in both the JSON and the compiled forms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { success } from "@sdxc/result";
import * as s from "remix/data-schema";
import { expectTypeOf, test } from "vitest";

import { createLanguage } from "./language.js";
import { defineOperator } from "./operator.js";

/** An operator with a compile step, whose compiled node carries what it prepared. */
const CIDR = defineOperator({
	op: "cidr",
	args: ["field", "range"],
	schema: s.object({ range: s.string() }),
	compile: (node) => success({ prefix: node.range }),
	test: (value, node, range) =>
		typeof value === "string" && value.startsWith(range.prefix) && node.range.length > 0,
});

/** An operator without one. */
const SEMVER = defineOperator({
	op: "semver",
	args: ["field", "compare", "value"],
	schema: s.object({ compare: s.enum_(["<", ">"]), value: s.string() }),
	test: (value, node) => typeof value === "string" && node.compare === "<",
});

test("derives every built-in, and nothing else, for a plain language", () => {
	let plain = createLanguage();
	type Expression = typeof plain.Expression;

	expectTypeOf<Extract<Expression, { op: "eq" }>>().toEqualTypeOf<
		| { op: "eq"; field: string; value: string | number | boolean | null; path?: never }
		| { op: "eq"; field: string; path: string; value?: never }
	>();
	expectTypeOf<Extract<Expression, { op: "intersects" }>>().toEqualTypeOf<
		| {
				op: "intersects";
				field: string;
				values: (string | number | boolean | null)[];
				path?: never;
		  }
		| { op: "intersects"; field: string; path: string; values?: never }
	>();
	expectTypeOf<Extract<Expression, { op: "matches" }>["pattern"]>().toEqualTypeOf<string>();
	expectTypeOf<Extract<Expression, { op: "all" }>["of"]>().toEqualTypeOf<Expression[]>();
	expectTypeOf<Extract<Expression, { op: "segment" }>>().toBeNever();
	expectTypeOf<Expression["op"]>().toEqualTypeOf<
		| "all"
		| "any"
		| "not"
		| "eq"
		| "ne"
		| "in"
		| "notIn"
		| "lt"
		| "lte"
		| "gt"
		| "gte"
		| "includes"
		| "intersects"
		| "subsetOf"
		| "startsWith"
		| "endsWith"
		| "contains"
		| "matches"
		| "exists"
		| "always"
	>();
});

test("keeps only the built-ins a language names", () => {
	let rules = createLanguage({ builtins: ["all", "contains"] });

	expectTypeOf<(typeof rules.Expression)["op"]>().toEqualTypeOf<"all" | "contains">();
});

test("spells the reference node the way the language names it", () => {
	let flags = createLanguage({ reference: "segment" });

	expectTypeOf<Extract<typeof flags.Expression, { op: "segment" }>>().toEqualTypeOf<{
		op: "segment";
		name: string;
	}>();
	expectTypeOf<Extract<typeof flags.Compiled, { op: "segment" }>["of"]>().toEqualTypeOf<
		typeof flags.Compiled
	>();
});

test("adds the nodes of every operator a language is given", () => {
	let network = createLanguage({ operators: [CIDR, SEMVER] });

	expectTypeOf<Extract<typeof network.Expression, { op: "cidr" }>>().toEqualTypeOf<{
		op: "cidr";
		field: string;
		range: string;
	}>();
	expectTypeOf<Extract<typeof network.Expression, { op: "semver" }>>().toEqualTypeOf<{
		op: "semver";
		field: string;
		compare: "<" | ">";
		value: string;
	}>();
	expectTypeOf<Extract<typeof network.Compiled, { op: "cidr" }>>().toEqualTypeOf<{
		op: "cidr";
		field: string;
		range: string;
		prepared: { prefix: string };
	}>();
	expectTypeOf<
		Extract<typeof network.Compiled, { op: "matches" }>["pattern"]
	>().toEqualTypeOf<RegExp>();
});

test("narrows a node written in code on its op", () => {
	let flags = createLanguage({ reference: "segment" });
	let condition: typeof flags.Expression = {
		op: "all",
		of: [
			{ op: "eq", field: "plan.tier", value: "pro" },
			{ op: "in", field: "country", values: ["AR"] },
		],
	};

	expectTypeOf(condition).toExtend<typeof flags.Expression>();
	// @ts-expect-error -- `lt` compares numbers only
	let wrong: typeof flags.Expression = { op: "lt", field: "age", value: "18" };
	expectTypeOf(wrong).not.toBeNever();
	// @ts-expect-error -- a comparison reads a literal or a path, never both
	let both: typeof flags.Expression = { op: "eq", field: "a", value: 1, path: "b" };
	expectTypeOf(both).not.toBeNever();
	// @ts-expect-error -- a comparison needs a right-hand side
	let neither: typeof flags.Expression = { op: "eq", field: "a" };
	expectTypeOf(neither).not.toBeNever();
});

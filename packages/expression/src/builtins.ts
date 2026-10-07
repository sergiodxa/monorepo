/**
 * The operators every language starts from: composition with `all`, `any` and
 * `not`, the constant `always`, and the field comparisons. Each comparison stays
 * within one type, so `eq` between a string and a number is false.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSONPrimitive } from "@sdxc/types";
import type { Schema } from "remix/data-schema";

import { failure, isFailure, success, wrap } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { FieldValue, Flatten, Operator } from "./operator.js";

import { ExpressionError } from "./expression-error.js";

/**
 * A comparison whose right-hand side is a literal under `Key` or a context
 * `path`, never both, so a node written in code still narrows on `op`.
 */
type Comparison<Op extends string, Key extends string, Value> =
	| Flatten<{ op: Op; field: string } & { [K in Key]: Value } & { path?: never }>
	| Flatten<{ op: Op; field: string; path: string } & { [K in Key]?: never }>;

/** The built-in leaves as they are written and stored. */
export type BuiltinLeaf =
	| Comparison<"eq", "value", JSONPrimitive>
	| Comparison<"ne", "value", JSONPrimitive>
	| Comparison<"in", "values", JSONPrimitive[]>
	| Comparison<"notIn", "values", JSONPrimitive[]>
	| Comparison<"lt", "value", number>
	| Comparison<"lte", "value", number>
	| Comparison<"gt", "value", number>
	| Comparison<"gte", "value", number>
	| Comparison<"includes", "value", JSONPrimitive>
	| Comparison<"intersects", "values", JSONPrimitive[]>
	| Comparison<"subsetOf", "values", JSONPrimitive[]>
	| { op: "startsWith"; field: string; value: string }
	| { op: "endsWith"; field: string; value: string }
	| { op: "contains"; field: string; value: string }
	| { op: "matches"; field: string; pattern: string }
	| { op: "exists"; field: string }
	| { op: "always" };

/** The built-in leaves once compiled: a `matches` pattern is a `RegExp` built with the `v` flag. */
export type CompiledBuiltinLeaf =
	| Exclude<BuiltinLeaf, { op: "matches" }>
	| { op: "matches"; field: string; pattern: RegExp };

/** The built-ins that compose other expressions instead of reading a field. */
export type StructuralName = "all" | "any" | "not";

/** Every built-in operator a language can keep or leave out with `builtins`. */
export type BuiltinName = StructuralName | BuiltinLeaf["op"];

/** Every built-in name, the default `builtins` of a language. */
export const BUILTIN_NAMES: readonly BuiltinName[] = [
	"all",
	"any",
	"not",
	"eq",
	"ne",
	"in",
	"notIn",
	"lt",
	"lte",
	"gt",
	"gte",
	"includes",
	"intersects",
	"subsetOf",
	"startsWith",
	"endsWith",
	"contains",
	"matches",
	"exists",
	"always",
];

/** A dotted path into the context, which an empty string cannot name. */
export const FIELD_SCHEMA: Schema<unknown, string> = s
	.string()
	.refine((field) => field.length > 0, "Expected a context field");

/** A value a comparison is written against, refusing anything JSON cannot carry. */
const JSON_PRIMITIVE_SCHEMA: Schema<unknown, JSONPrimitive> = s.union([
	s.string(),
	s.number(),
	s.boolean(),
	s.null_(),
]);

/**
 * The answer of a built-in over two operands: a boolean, or `undefined` when
 * the operands' types do not fit the operator, which the language answers for.
 */
type Compare = (left: FieldValue, right: unknown) => boolean | undefined;

/** What evaluation knows about a built-in beyond its `test`. */
export interface Builtin {
	/** The node field holding the literal right-hand side. */
	key: "value" | "values" | "pattern";
	/** Holds for a built-in that also takes its right-hand side from a context `path`. */
	paths: boolean;
	compare: Compare;
}

/** The built-in field operators by their `Operator`, which is how evaluation tells one from an extension. */
export const BUILTINS: Map<Operator<any, any>, Builtin> = new Map();

/** A built-in leaf that reads a field, by its name. */
type FieldLeaf<Op extends string> = Extract<BuiltinLeaf, { op: Op; field: string }>;

/**
 * Declares a built-in field operator whose stored node is already its compiled
 * form, which is every one of them except `matches`. Its `test` answers a
 * literal comparison exactly as `compare` does, with `mismatch` for operands of
 * the wrong type.
 */
function leaf<const Op extends FieldLeaf<string>["op"]>(
	op: Op,
	key: Builtin["key"],
	schema: Schema<unknown, object>,
	compare: Compare,
	mismatch = false,
): Operator<FieldLeaf<Op>, FieldLeaf<Op>> {
	let operator: Operator<any, any> = {
		op,
		args: ["field", key],
		schema,
		compile: success,
		test: (value, node: Record<string, unknown>) => compare(value, node[key]) ?? mismatch,
	};
	BUILTINS.set(operator, { key, paths: false, compare });
	return operator as Operator<FieldLeaf<Op>, FieldLeaf<Op>>;
}

/**
 * Declares a built-in comparison that takes its right-hand side from either a
 * literal under `key` or a context `path`.
 */
function comparison<const Op extends FieldLeaf<string>["op"]>(
	op: Op,
	key: "value" | "values",
	literal: Schema<unknown, unknown>,
	compare: Compare,
	mismatch = false,
): Operator<FieldLeaf<Op>, FieldLeaf<Op>> {
	let operator = leaf(op, key, operandSchema(key, literal), compare, mismatch);
	BUILTINS.set(operator, { key, paths: true, compare });
	return operator;
}

/**
 * Validates a right-hand side written as a literal under `key` or as a `path`.
 * The object schemas strip unknown keys, so exclusivity is checked here.
 */
function operandSchema(key: string, literal: Schema<unknown, unknown>): Schema<unknown, object> {
	let byValue = s.object({ [key]: literal });
	let byPath = s.object({ path: FIELD_SCHEMA });

	return s.createSchema<unknown, object>((value, context) => {
		let written = typeof value === "object" && value !== null ? value : {};
		let hasValue = Object.hasOwn(written, key);
		let hasPath = Object.hasOwn(written, "path");

		if (hasValue && hasPath) {
			let message = `Expected "${key}" or "path", not both`;
			return { issues: [s.createIssue(message, [...context.path, "path"])] };
		}
		if (!hasValue && !hasPath) {
			let message = `Expected "${key}" or "path"`;
			return { issues: [s.createIssue(message, [...context.path, key])] };
		}
		return (hasPath ? byPath : byValue)["~run"](value, context);
	});
}

/** A JSON scalar `eq` compares within its type. */
function isScalar(value: unknown): value is string | number | boolean {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/**
 * Equality within one type: two `Date`s agree on their time value, two scalars
 * of one type are identical, a literal `null` matches `null` alone, and
 * anything else is a type mismatch.
 */
export function equal(left: unknown, right: unknown): boolean | undefined {
	if (right === null) return left === null;
	if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime();
	if (!isScalar(left) || !isScalar(right) || typeof left !== typeof right) return undefined;
	return left === right;
}

/** List membership, where a member of another type than the needle never matches. */
function member(needle: unknown, list: readonly unknown[]): boolean {
	return list.some((item) => equal(needle, item) === true);
}

/** Holds for a value `in` can look up: a scalar, a `Date`, or `null`. */
function isNeedle(value: unknown): boolean {
	return value === null || value instanceof Date || isScalar(value);
}

/** Membership of a single value in a list, a mismatch for a structure or a non-list. */
function within(left: unknown, right: unknown): boolean | undefined {
	if (!isNeedle(left) || !Array.isArray(right)) return undefined;
	return member(left, right);
}

/** Membership of a value in a list field, a mismatch for a field that is no list or a structure as the value. */
function includes(left: unknown, right: unknown): boolean | undefined {
	if (!Array.isArray(left) || !isNeedle(right)) return undefined;
	return member(right, left);
}

/**
 * Compares two lists member by member with `eq`, a mismatch unless both are
 * lists; `some` asks whether they share a member, `every` whether the field
 * fits inside the other list.
 */
function lists(quantifier: "some" | "every"): Compare {
	return (left, right) => {
		if (!Array.isArray(left) || !Array.isArray(right)) return undefined;
		return left[quantifier]((item) => member(item, right));
	};
}

/** Orders two numbers, or two `Date`s by time value, a mismatch for anything else. */
function order(compare: (left: number, right: number) => boolean): Compare {
	return (left, right) => {
		if (typeof left === "number" && typeof right === "number") return compare(left, right);
		if (left instanceof Date && right instanceof Date) {
			return compare(left.getTime(), right.getTime());
		}
		return undefined;
	};
}

/** A substring test on a string field, a mismatch for any other field. */
function text(compare: (left: string, right: string) => boolean): Compare {
	return (left, right) => {
		if (typeof left !== "string" || typeof right !== "string") return undefined;
		return compare(left, right);
	};
}

/**
 * Holds for a field that resolved to anything, `null` included. The language
 * answers it from the path itself, which is why its test is never consulted.
 */
export const EXISTS: Operator<FieldLeaf<"exists">, FieldLeaf<"exists">> = {
	op: "exists",
	args: ["field"],
	schema: s.object({}),
	compile: success,
	test: () => true,
};

/**
 * Compiles a pattern with the `v` flag once, so a pattern that does not compile
 * fails the expression that carries it instead of a request.
 */
const MATCHES: Operator<FieldLeaf<"matches">, Extract<CompiledBuiltinLeaf, { op: "matches" }>> = {
	op: "matches",
	args: ["field", "pattern"],
	schema: s.object({ pattern: s.string() }),
	compile(node) {
		let pattern = wrap(() => new RegExp(node.pattern, "v"));
		if (isFailure(pattern)) {
			let message = `Pattern ${JSON.stringify(node.pattern)} does not compile`;
			return failure(new ExpressionError(message, { path: "pattern", cause: pattern.error }));
		}
		return success({ op: "matches", field: node.field, pattern: pattern.data });
	},
	test(value, node) {
		return typeof value === "string" && node.pattern.test(value);
	},
};

BUILTINS.set(MATCHES, {
	key: "pattern",
	paths: false,
	compare: (left, right) => (typeof left === "string" ? (right as RegExp).test(left) : undefined),
});

/**
 * The built-in field operators by name, in the order a language registers them.
 * `ne` and `notIn` answer `true` for a field of another type than a literal,
 * since such a field is indeed not equal to it.
 */
export const FIELD_BUILTINS: ReadonlyMap<string, Operator<any, any>> = new Map<
	string,
	Operator<any, any>
>([
	["eq", comparison("eq", "value", JSON_PRIMITIVE_SCHEMA, equal)],
	["ne", comparison("ne", "value", JSON_PRIMITIVE_SCHEMA, negate(equal), true)],
	["in", comparison("in", "values", s.array(JSON_PRIMITIVE_SCHEMA), within)],
	["notIn", comparison("notIn", "values", s.array(JSON_PRIMITIVE_SCHEMA), negate(within), true)],
	[
		"lt",
		comparison(
			"lt",
			"value",
			s.number(),
			order((left, right) => left < right),
		),
	],
	[
		"lte",
		comparison(
			"lte",
			"value",
			s.number(),
			order((left, right) => left <= right),
		),
	],
	[
		"gt",
		comparison(
			"gt",
			"value",
			s.number(),
			order((left, right) => left > right),
		),
	],
	[
		"gte",
		comparison(
			"gte",
			"value",
			s.number(),
			order((left, right) => left >= right),
		),
	],
	["includes", comparison("includes", "value", JSON_PRIMITIVE_SCHEMA, includes)],
	["intersects", comparison("intersects", "values", s.array(JSON_PRIMITIVE_SCHEMA), lists("some"))],
	["subsetOf", comparison("subsetOf", "values", s.array(JSON_PRIMITIVE_SCHEMA), lists("every"))],
	[
		"startsWith",
		leaf(
			"startsWith",
			"value",
			s.object({ value: s.string() }),
			text((left, right) => left.startsWith(right)),
		),
	],
	[
		"endsWith",
		leaf(
			"endsWith",
			"value",
			s.object({ value: s.string() }),
			text((left, right) => left.endsWith(right)),
		),
	],
	[
		"contains",
		leaf(
			"contains",
			"value",
			s.object({ value: s.string() }),
			text((left, right) => left.includes(right)),
		),
	],
	["matches", MATCHES],
	["exists", EXISTS],
]);

/** Flips a comparison's answer, keeping a type mismatch a mismatch. */
function negate(compare: Compare): Compare {
	return (left, right) => {
		let answer = compare(left, right);
		return answer === undefined ? undefined : !answer;
	};
}

/**
 * The context path a built-in comparison reads its right-hand side from, when
 * it reads one. An extension operator's own field named `path` stays its own,
 * so this answers `undefined` for every extension.
 */
export function comparedPath(
	operator: Operator<any, any> | undefined,
	node: Readonly<Record<string, unknown>>,
): string | undefined {
	if (operator === undefined || BUILTINS.get(operator)?.paths !== true) return undefined;
	return typeof node.path === "string" ? node.path : undefined;
}

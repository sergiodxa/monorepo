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

import type { FieldValue, Operator } from "./operator.js";

import { ExpressionError } from "./expression-error.js";

/** The built-in leaves as they are written and stored. */
export type BuiltinLeaf =
	| { op: "eq"; field: string; value: JSONPrimitive }
	| { op: "ne"; field: string; value: JSONPrimitive }
	| { op: "in"; field: string; values: JSONPrimitive[] }
	| { op: "notIn"; field: string; values: JSONPrimitive[] }
	| { op: "lt"; field: string; value: number }
	| { op: "lte"; field: string; value: number }
	| { op: "gt"; field: string; value: number }
	| { op: "gte"; field: string; value: number }
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
	"startsWith",
	"endsWith",
	"contains",
	"matches",
	"exists",
	"always",
];

/** A value a comparison is written against, refusing anything JSON cannot carry. */
const JSON_PRIMITIVE_SCHEMA: Schema<unknown, JSONPrimitive> = s.union([
	s.string(),
	s.number(),
	s.boolean(),
	s.null_(),
]);

/** A built-in leaf that reads a field, by its name. */
type FieldLeaf<Op extends string> = Extract<BuiltinLeaf, { op: Op; field: string }>;

/**
 * Declares a built-in field operator whose stored node is already its compiled
 * form, which is every one of them except `matches`.
 */
function leaf<const Op extends FieldLeaf<string>["op"]>(
	op: Op,
	args: readonly string[],
	schema: Schema<unknown, object>,
	test: (value: FieldValue, node: FieldLeaf<Op>) => boolean,
): Operator<FieldLeaf<Op>, FieldLeaf<Op>> {
	let operator = { op, args, schema, compile: success, test };
	return operator as Operator<FieldLeaf<Op>, FieldLeaf<Op>>;
}

/** The node schema of the four orderings, which compare numbers only. */
const NUMBER_VALUE_SCHEMA = s.object({ value: s.number() });

/** The node schema of the three substring tests, which compare strings only. */
const STRING_VALUE_SCHEMA = s.object({ value: s.string() });

/**
 * Holds for a field that resolved to anything, `null` included. The language
 * answers it from the path itself, which is why its test is never consulted.
 */
export const EXISTS = leaf("exists", ["field"], s.object({}), () => true);

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

/** The built-in field operators by name, in the order a language registers them. */
export const FIELD_BUILTINS: ReadonlyMap<string, Operator<any, any>> = new Map<
	string,
	Operator<any, any>
>([
	[
		"eq",
		leaf("eq", ["field", "value"], s.object({ value: JSON_PRIMITIVE_SCHEMA }), (value, node) => {
			return value === node.value;
		}),
	],
	[
		"ne",
		leaf("ne", ["field", "value"], s.object({ value: JSON_PRIMITIVE_SCHEMA }), (value, node) => {
			return value !== node.value;
		}),
	],
	[
		"in",
		leaf(
			"in",
			["field", "values"],
			s.object({ values: s.array(JSON_PRIMITIVE_SCHEMA) }),
			(value, node) => node.values.some((member) => member === value),
		),
	],
	[
		"notIn",
		leaf(
			"notIn",
			["field", "values"],
			s.object({ values: s.array(JSON_PRIMITIVE_SCHEMA) }),
			(value, node) => node.values.every((member) => member !== value),
		),
	],
	[
		"lt",
		leaf("lt", ["field", "value"], NUMBER_VALUE_SCHEMA, (value, node) => {
			return typeof value === "number" && value < node.value;
		}),
	],
	[
		"lte",
		leaf("lte", ["field", "value"], NUMBER_VALUE_SCHEMA, (value, node) => {
			return typeof value === "number" && value <= node.value;
		}),
	],
	[
		"gt",
		leaf("gt", ["field", "value"], NUMBER_VALUE_SCHEMA, (value, node) => {
			return typeof value === "number" && value > node.value;
		}),
	],
	[
		"gte",
		leaf("gte", ["field", "value"], NUMBER_VALUE_SCHEMA, (value, node) => {
			return typeof value === "number" && value >= node.value;
		}),
	],
	[
		"startsWith",
		leaf("startsWith", ["field", "value"], STRING_VALUE_SCHEMA, (value, node) => {
			return typeof value === "string" && value.startsWith(node.value);
		}),
	],
	[
		"endsWith",
		leaf("endsWith", ["field", "value"], STRING_VALUE_SCHEMA, (value, node) => {
			return typeof value === "string" && value.endsWith(node.value);
		}),
	],
	[
		"contains",
		leaf("contains", ["field", "value"], STRING_VALUE_SCHEMA, (value, node) => {
			return typeof value === "string" && value.includes(node.value);
		}),
	],
	["matches", MATCHES],
	["exists", EXISTS],
]);

/**
 * The runtime description of one language: which operators it knows and the
 * schema its JSON form validates against. Compiling, evaluating, parsing and
 * printing all read the same grammar, so the four always agree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import * as s from "remix/data-schema";
import { lazy } from "remix/data-schema/lazy";

import type { BuiltinName, StructuralName } from "./builtins.js";
import type { AnyOperator } from "./expression.js";

import { FIELD_BUILTINS, FIELD_SCHEMA } from "./builtins.js";

/** A node of any language, as the internals walk it before the public types apply. */
export interface Node {
	op: string;
	[field: string]: unknown;
}

/** Everything the steps of a language need to know about it. */
export interface Grammar {
	/** The composing built-ins this language keeps, plus `always`. */
	structural: ReadonlySet<StructuralName | "always">;
	/** The field operators by name, built-ins and extensions alike. */
	fields: ReadonlyMap<string, AnyOperator>;
	/** How a reference is spelled, absent when the language has none. */
	reference?: string;
	schema: Schema<unknown, Node>;
}

/**
 * Builds a grammar from the built-ins kept and the operators added. An added
 * operator named like a built-in replaces it, since it registers last.
 */
export function createGrammar(
	builtins: readonly BuiltinName[],
	operators: readonly AnyOperator[],
	reference: string | undefined,
): Grammar {
	let kept = new Set<string>(builtins);
	let structural = new Set<StructuralName | "always">();
	for (let name of ["all", "any", "not", "always"] as const)
		if (kept.has(name)) structural.add(name);

	let fields = new Map<string, AnyOperator>();
	for (let [name, operator] of FIELD_BUILTINS) if (kept.has(name)) fields.set(name, operator);
	for (let operator of operators) fields.set(operator.op, operator);

	let known: Omit<Grammar, "schema"> =
		reference === undefined ? { structural, fields } : { structural, fields, reference };
	return { ...known, schema: nodeSchema(known) };
}

/**
 * The schema of a whole expression in this grammar: one variant per operator,
 * recursing through the composing ones.
 */
function nodeSchema(grammar: Omit<Grammar, "schema">): Schema<unknown, Node> {
	let variants: Record<string, Schema<unknown, Node>> = {};
	let self: Schema<unknown, Node> = lazy(() => byOperator(variants));

	for (let name of grammar.structural) {
		if (name === "always") variants[name] = s.object({ op: s.literal(name) });
		else if (name === "not") variants[name] = s.object({ op: s.literal(name), of: self });
		else variants[name] = s.object({ op: s.literal(name), of: s.array(self) });
	}

	if (grammar.reference !== undefined) {
		let op = grammar.reference;
		variants[op] = s.object({ op: s.literal(op), name: s.string() });
	}

	for (let operator of grammar.fields.values()) variants[operator.op] = fieldSchema(operator);

	return self;
}

/**
 * Picks the variant a node's `op` names, refusing an operator this language
 * leaves out with a message that names it.
 */
function byOperator(variants: Record<string, Schema<unknown, Node>>): Schema<unknown, Node> {
	let variant = s.variant("op", variants);

	return s.createSchema<unknown, Node>((value, context) => {
		let op =
			typeof value === "object" && value !== null ? (value as { op?: unknown }).op : undefined;
		if (typeof op === "string" && !Object.hasOwn(variants, op)) {
			let message = `"${op}" is not an operator of this language`;
			return { issues: [s.createIssue(message, [...context.path, "op"])] };
		}
		return variant["~run"](value, context);
	});
}

/**
 * Validates a field operator's node: `op` and `field` here, the rest through
 * the operator's own schema, so every operator reads a non-empty path.
 */
function fieldSchema(operator: AnyOperator): Schema<unknown, Node> {
	let head = s.object({ op: s.literal(operator.op), field: FIELD_SCHEMA });

	return s.createSchema<unknown, Node>((value, context) => {
		let shared = head["~run"](value, context);
		let own = operator.schema["~run"](value, context);
		if (shared.issues || own.issues) {
			return { issues: [...(shared.issues ?? []), ...(own.issues ?? [])] };
		}
		return { value: { ...own.value, ...shared.value } as Node };
	});
}

/**
 * Prints an expression in the canonical text form, which parses back to the
 * same JSON. Parentheses appear exactly where a nested `and` or `or` would
 * otherwise merge into its parent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Node } from "./grammar.js";

import { BUILTINS, comparedPath } from "./builtins.js";
import { COMPARISONS } from "./parse.js";
import { BARE_SEGMENT } from "./tokenize.js";

/** A call argument printed as a context path, which a literal object can never be mistaken for. */
class ContextPath {
	constructor(readonly field: string) {}
}

/** The infix spelling of each comparison operator. */
const INFIX: Readonly<Record<string, string>> = {
	...Object.fromEntries(Object.entries(COMPARISONS).map(([symbol, op]) => [op, symbol])),
	in: "in",
	notIn: "not in",
};

/**
 * Prints one expression.
 *
 * @param grammar The language it is written in, which supplies each operator's call order.
 * @param node A valid expression of that language.
 */
export function stringify(grammar: Grammar, node: Node): string {
	switch (node.op) {
		case "all":
		case "any": {
			let of = node.of as Node[];
			if (of.length < 2)
				return `${node.op}(${of.map((member) => stringify(grammar, member)).join(", ")})`;
			let keyword = node.op === "all" ? " and " : " or ";
			return of.map((member) => operand(grammar, member, node.op === "all")).join(keyword);
		}
		case "not":
			return `not ${operand(grammar, node.of as Node, true)}`;
		case "always":
			return "true";
	}

	if (node.op === grammar.reference) return `${node.op}(${literal(node.name)})`;

	let operator = grammar.fields.get(node.op);
	let field = path(node.field as string);
	let right = comparedPath(operator, node);
	let infix = INFIX[node.op];
	if (infix !== undefined) {
		let value = node.op === "in" || node.op === "notIn" ? node.values : node.value;
		return `${field} ${infix} ${right === undefined ? literal(value) : path(right)}`;
	}

	let written: Record<string, unknown> = { ...node };
	if (right !== undefined && operator !== undefined) {
		written[BUILTINS.get(operator)?.key ?? "value"] = new ContextPath(right);
	}

	let names = [...(operator?.args.slice(1) ?? [])];
	while (names.length > 0 && written[names[names.length - 1] ?? ""] === undefined) names.pop();
	let args = [field, ...names.map((name) => argument(written[name]))];
	return `${node.op}(${args.join(", ")})`;
}

/**
 * Prints a member of an `and`, an `or` or a `not`, wrapping a nested infix
 * chain that would otherwise merge into it: under `and` (or `not`) both kinds
 * of chain, under `or` only another `or`.
 */
function operand(grammar: Grammar, node: Node, tight: boolean): string {
	let text = stringify(grammar, node);
	let chain = (node.op === "all" || node.op === "any") && (node.of as Node[]).length >= 2;
	if (!chain) return text;
	if (tight || node.op === "any") return `(${text})`;
	return text;
}

/**
 * Prints a context path under `ctx.`, each segment bare when the text form can
 * read it back that way and backtick-quoted otherwise.
 */
function path(field: string): string {
	let segments = field.split(".").map((segment) => {
		if (BARE_SEGMENT.test(segment)) return segment;
		return `\`${segment.replaceAll(/[`\\]/g, "\\$&")}\``;
	});
	return `ctx.${segments.join(".")}`;
}

/** Prints a call argument: a context path the caller marked as `{ path }`, or a literal. */
function argument(value: unknown): string {
	if (value instanceof ContextPath) return path(value.field);
	return literal(value);
}

/** Prints a JSON literal, with a space after each comma and colon. */
function literal(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
	if (typeof value === "object" && value !== null) {
		let entries = Object.entries(value).map(
			([key, member]) => `${JSON.stringify(key)}: ${literal(member)}`,
		);
		return `{${entries.join(", ")}}`;
	}
	return JSON.stringify(value ?? null);
}

/**
 * Prints an expression in the canonical text form, which parses back to the
 * same JSON. Parentheses appear exactly where a nested `and` or `or` would
 * otherwise merge into its parent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Node } from "./grammar.js";

import { COMPARISONS, KEYWORDS } from "./parse.js";
import { WORD } from "./tokenize.js";

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

	let field = path(node.field as string);
	let infix = INFIX[node.op];
	if (infix !== undefined) {
		return `${field} ${infix} ${literal(node.op === "in" || node.op === "notIn" ? node.values : node.value)}`;
	}

	let names = [...(grammar.fields.get(node.op)?.args.slice(1) ?? [])];
	while (names.length > 0 && node[names[names.length - 1] ?? ""] === undefined) names.pop();
	let args = [field, ...names.map((name) => literal(node[name]))];
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

/** Prints a field bare when the text form can read it back that way, backtick-quoted otherwise. */
function path(field: string): string {
	WORD.lastIndex = 0;
	let bare = WORD.exec(field);
	if (bare?.[0] === field && !KEYWORDS.has(field)) return field;
	return `\`${field.replaceAll(/[`\\]/g, "\\$&")}\``;
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

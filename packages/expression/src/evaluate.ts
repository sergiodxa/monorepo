/**
 * Whether a compiled expression holds for a context. Synchronous and pure: the
 * compiled tree already carries every pattern and reference, so evaluation is
 * a walk over it and a field read per leaf.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Node } from "./grammar.js";
import type { Context } from "./read.js";

import { EXISTS } from "./builtins.js";
import { read } from "./read.js";

/**
 * Answers whether `node` holds. A field that resolves to nothing holds for no
 * operator except `exists`, which keeps an expression about a field the caller
 * left out from matching everyone.
 *
 * @param grammar The language that compiled the node.
 * @param node A node as `compile` returned it.
 * @param context The fields the expression reads.
 */
export function evaluate(grammar: Grammar, node: Node, context: Context): boolean {
	switch (node.op) {
		case "all":
			return (node.of as Node[]).every((member) => evaluate(grammar, member, context));
		case "any":
			return (node.of as Node[]).some((member) => evaluate(grammar, member, context));
		case "not":
			return !evaluate(grammar, node.of as Node, context);
		case "always":
			return true;
	}

	if (node.op === grammar.reference) return evaluate(grammar, node.of as Node, context);

	let operator = grammar.fields.get(node.op);
	if (operator === undefined) return false;

	let value = read(context, node.field as string);
	if (operator === EXISTS) return value !== undefined;
	if (value === undefined) return false;
	return operator.test(value, node);
}

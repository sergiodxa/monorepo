/**
 * Whether a compiled expression holds for a context. Synchronous and pure: the
 * compiled tree already carries every pattern and reference, so evaluation is
 * a walk over it and a path read per operand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Node } from "./grammar.js";

import { BUILTINS, EXISTS } from "./builtins.js";
import { read } from "./read.js";

/**
 * Answers whether `node` holds. A path that resolves to nothing holds for no
 * operator except `exists`, which keeps an expression about a field the caller
 * left out from matching everyone. A comparison between two paths answers
 * `false` when either holds `null` or their types do not fit the operator.
 *
 * @param grammar The language that compiled the node.
 * @param node A node as `compile` returned it.
 * @param context The fields the expression reads.
 */
export function evaluate(grammar: Grammar, node: Node, context: object): boolean {
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

	let builtin = BUILTINS.get(operator);
	if (builtin?.paths !== true || typeof node.path !== "string") return operator.test(value, node);

	let other = read(context, node.path);
	if (other === undefined || other === null || value === null) return false;
	return builtin.compare(value, other) ?? false;
}

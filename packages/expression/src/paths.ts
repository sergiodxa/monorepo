/**
 * Lists the context paths a compiled expression reads, so a consumer loads
 * only the facts a rule needs and refuses a rule reading a root its caller
 * never supplies, without walking the tree itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Grammar, Node } from "./grammar.js";

import { comparedPath } from "./builtins.js";

/**
 * Collects every `field` and every compared `path` under `node`, through
 * references, extension operators' `field` included.
 *
 * @param grammar The language that compiled the node.
 * @param node A node as `compile` returned it.
 * @param into Where the paths are collected.
 */
export function paths(grammar: Grammar, node: Node, into: Set<string> = new Set()): Set<string> {
	switch (node.op) {
		case "all":
		case "any":
			for (let member of node.of as Node[]) paths(grammar, member, into);
			return into;
		case "not":
			return paths(grammar, node.of as Node, into);
		case "always":
			return into;
	}

	if (node.op === grammar.reference) return paths(grammar, node.of as Node, into);

	if (typeof node.field === "string") into.add(node.field);
	let path = comparedPath(grammar.fields.get(node.op), node);
	if (path !== undefined) into.add(path);
	return into;
}

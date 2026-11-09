/**
 * Reads which values a set of stubs needs and in what shape, from how each placeholder is used.
 * A command line builds its flags and its help from this, so a blueprint documents itself and
 * the documentation can never fall behind the stubs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Renderable } from "./render.js";
import type { Node } from "./template.js";

import { BlueprintError } from "./errors.js";
import { templateOf } from "./render.js";

/** Where a stub reads a value. */
export interface Use {
	source: string;
	line: number;
}

/** A value stubs read, and the shape their uses give it. */
export interface Variable {
	name: string;
	/**
	 * `text` when a placeholder writes it, `flag` when only `{{#if}}` tests it, `list` when
	 * `{{#each}}` walks it.
	 */
	kind: "text" | "flag" | "list";
	/** Every place it is read, in stub order. */
	uses: Use[];
}

/** How one use shapes a value. */
type UseKind = "text" | "test" | "list";

/** The use each kind of node makes of the value it names. */
const USE_KINDS: Readonly<Record<Exclude<Node["type"], "text">, UseKind>> = {
	value: "text",
	if: "test",
	each: "list",
};

/** The shape a value takes from the ways it is used: a list wins, then text, then a flag. */
function kindOf(kinds: ReadonlyMap<UseKind, Use>): Variable["kind"] {
	if (kinds.has("list")) return "list";
	if (kinds.has("text")) return "text";
	return "flag";
}

/**
 * The values `inputs` read, in order of first use. `{{item}}` inside an `each` is the loop's own
 * and is left out. A value that one place walks as a list and another writes as text fails,
 * naming both places.
 */
export function variables(inputs: readonly Renderable[]): Result<Variable[], BlueprintError> {
	let found = new Map<string, { kinds: Map<UseKind, Use>; uses: Use[] }>();

	/** Records the uses in `nodes`, inside `inEach` loops or not. */
	function visit(nodes: readonly Node[], source: string, inEach: boolean): void {
		for (let node of nodes) {
			if (node.type === "text") continue;
			let use = { source, line: node.line };
			if (!(inEach && node.name === "item")) {
				let entry = found.get(node.name) ?? { kinds: new Map(), uses: [] };
				let kind = USE_KINDS[node.type];
				if (!entry.kinds.has(kind)) entry.kinds.set(kind, use);
				entry.uses.push(use);
				found.set(node.name, entry);
			}
			if (node.type !== "value") visit(node.children, source, inEach || node.type === "each");
		}
	}

	for (let input of inputs) {
		let template = templateOf(input);
		if (isFailure(template)) return template;
		visit(template.data.nodes, template.data.source, false);
	}

	let result: Variable[] = [];
	for (let [name, { kinds, uses }] of found) {
		let list = kinds.get("list");
		let text = kinds.get("text");
		if (list !== undefined && text !== undefined) {
			return failure(
				new BlueprintError(
					`{{${name}}} is a list in ${list.source}:${list.line} and text in ${text.source}:${text.line}`,
				),
			);
		}
		result.push({ name, kind: kindOf(kinds), uses });
	}
	return success(result);
}

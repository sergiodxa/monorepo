/**
 * The parsed view of a module the source-rule checks read: its oxc AST, its comments, and a walk
 * that hands every node its ancestors, so a rule decides on a node and where it sits in one pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Comment } from "oxc-parser";

import { parseSync } from "oxc-parser";

/** An oxc AST node, read by `type` and by whichever fields a rule needs. */
export interface SyntaxNode {
	type: string;
	start: number;
	end: number;
	[field: string]: unknown;
}

/** A module's AST and comments. */
export interface ParsedModule {
	program: SyntaxNode;
	comments: Comment[];
}

/**
 * The module oxc parses from `source`, or `null` when it cannot, so the type checker rather than
 * doctor names the syntax error.
 */
export function parseModule(file: string, source: string): ParsedModule | null {
	let parsed = parseSync(file, source);
	if (parsed.errors.length > 0) return null;
	return { program: parsed.program as unknown as SyntaxNode, comments: parsed.comments };
}

/** Calls `enter` on every node under `root`, depth first, with its ancestors outermost first. */
export function walk(
	root: SyntaxNode,
	enter: (node: SyntaxNode, ancestors: readonly SyntaxNode[]) => void,
): void {
	let ancestors: SyntaxNode[] = [];
	let visit = (node: SyntaxNode): void => {
		enter(node, ancestors);
		ancestors.push(node);
		for (let child of children(node)) visit(child);
		ancestors.pop();
	};
	visit(root);
}

/** The nodes held directly by `node`'s fields, in source order. */
function children(node: SyntaxNode): SyntaxNode[] {
	let found: SyntaxNode[] = [];
	for (let [key, value] of Object.entries(node)) {
		if (key === "type") continue;
		for (let item of Array.isArray(value) ? value : [value]) {
			if (isNode(item)) found.push(item);
		}
	}
	return found;
}

/** Whether `value` is an AST node rather than a scalar or a plain field object. */
export function isNode(value: unknown): value is SyntaxNode {
	return (
		typeof value === "object" && value !== null && typeof Reflect.get(value, "type") === "string"
	);
}

/** The 1-based line holding character `index` of `source`. */
export function lineAt(source: string, index: number): number {
	let line = 1;
	for (let at = 0; at < index && at < source.length; at++) {
		if (source.charCodeAt(at) === 10) line += 1;
	}
	return line;
}

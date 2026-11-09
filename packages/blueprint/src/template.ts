/**
 * Compiles a stub body into the tree `render` and `variables` walk: text, `{{value | filter}}`,
 * `{{#if}}` and `{{#each}}` blocks. A block tag alone on its line takes the line with it, so
 * blocks leave no blank lines, and a `{{` that forms no tag stays text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { BlueprintError } from "./errors.js";

/** Literal text, written as it is. */
export interface TextNode {
	type: "text";
	text: string;
}

/** A `{{name | filter}}` placeholder. */
export interface ValueNode {
	type: "value";
	name: string;
	filters: string[];
	line: number;
	/**
	 * The indentation before a placeholder standing alone on its line, which every later line of
	 * a multi-line value takes; `null` when other text shares the line.
	 */
	indent: string | null;
}

/** A `{{#if name}}` or `{{#each name}}` block and what it holds. */
export interface BlockNode {
	type: "if" | "each";
	name: string;
	line: number;
	children: Node[];
}

/** One piece of a compiled stub. */
export type Node = TextNode | ValueNode | BlockNode;

/** A compiled stub body, ready to render as many times as needed. */
export interface Template {
	/** The name errors use for this stub, such as its path. */
	source: string;
	nodes: Node[];
}

/**
 * Every tag, or an escaped `\{{`. Groups: 1 opening block kind, 2 its name, 3 closing block
 * kind, 4 a placeholder's name, 5 its filters.
 */
const TAG =
	/\\\{\{|\{\{\s*(?:#(if|each)\s+([A-Za-z_]\w*)|\/(if|each)|([A-Za-z_]\w*)((?:\s*\|\s*[A-Za-z_]\w*)*))\s*\}\}/g;

/** A block being filled while its body is read. */
interface OpenBlock {
	node: BlockNode;
	/** Where its nodes go once it closes. */
	parent: Node[];
}

/**
 * Compiles `body`. Unclosed, unopened and mismatched blocks, and an `each` inside an `each`, fail
 * with the stub and line.
 *
 * @param firstLine - The file line the body starts on, so lines count front matter too
 */
export function compile(
	body: string,
	source: string,
	firstLine = 1,
): Result<Template, BlueprintError> {
	let root: Node[] = [];
	let target = root;
	let stack: OpenBlock[] = [];
	let cursor = 0;

	/** The file line of `offset` in the body. */
	function lineAt(offset: number): number {
		let line = firstLine;
		for (let index = body.indexOf("\n"); index !== -1 && index < offset;) {
			line += 1;
			index = body.indexOf("\n", index + 1);
		}
		return line;
	}

	/** Appends text, joining it to text just before. */
	function text(value: string): void {
		if (value === "") return;
		let last = target.at(-1);
		if (last?.type === "text") last.text += value;
		else target.push({ type: "text", text: value });
	}

	for (let match of body.matchAll(TAG)) {
		let start = match.index;
		let end = start + match[0].length;
		if (match[0] === "\\{{") {
			text(body.slice(cursor, start));
			text("{{");
			cursor = end;
			continue;
		}
		let lineStart = body.lastIndexOf("\n", start - 1) + 1;
		let lineEndIndex = body.indexOf("\n", end);
		let lineEnd = lineEndIndex === -1 ? body.length : lineEndIndex;
		let before = body.slice(Math.max(lineStart, cursor), start);
		let alone =
			lineStart >= cursor && /^[ \t]*$/.test(before) && body.slice(end, lineEnd).trim() === "";
		let line = lineAt(start);
		let [, openKind, openName, closeKind, valueName, filters] = match;

		if (valueName !== undefined) {
			text(body.slice(cursor, start));
			target.push({
				type: "value",
				name: valueName,
				filters: (filters ?? "")
					.split("|")
					.map((filter) => filter.trim())
					.filter((filter) => filter !== ""),
				line,
				indent: alone ? before : null,
			});
			cursor = end;
			continue;
		}

		text(body.slice(cursor, alone ? lineStart : start));
		cursor = alone ? Math.min(lineEnd + 1, body.length) : end;

		if (openKind === "if" || openKind === "each") {
			if (openKind === "each" && stack.some((open) => open.node.type === "each")) {
				return failure(
					new BlueprintError("{{#each}} cannot hold another {{#each}}", { source, line }),
				);
			}
			let node: BlockNode = { type: openKind, name: openName ?? "", line, children: [] };
			stack.push({ node, parent: target });
			target = node.children;
			continue;
		}

		let open = stack.pop();
		if (open === undefined) {
			return failure(new BlueprintError(`{{/${closeKind}}} closes no block`, { source, line }));
		}
		if (open.node.type !== closeKind) {
			return failure(
				new BlueprintError(
					`{{/${closeKind}}} closes the {{#${open.node.type} ${open.node.name}}} opened on line ${open.node.line}`,
					{ source, line },
				),
			);
		}
		open.parent.push(open.node);
		target = open.parent;
	}
	text(body.slice(cursor));

	let unclosed = stack.at(-1);
	if (unclosed !== undefined) {
		return failure(
			new BlueprintError(`{{#${unclosed.node.type} ${unclosed.node.name}}} is never closed`, {
				source,
				line: unclosed.node.line,
			}),
		);
	}
	return success({ source, nodes: root });
}

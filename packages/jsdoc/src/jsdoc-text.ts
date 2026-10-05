/**
 * Finds the `/** … *\/` block attached to a node by reading the comment ranges
 * ahead of it. The file's own leading block is claimed for the module first, so
 * a header comment is never mistaken for the documentation of what follows it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import ts from "typescript";

import type { DocComment } from "./types.js";

import { parseComment } from "./comment.js";

/** The file's leading block and where it ends, so declarations can skip past it. */
export interface ModuleComment {
	comment: DocComment | null;
	/** Offset every declaration comment must start at or after. */
	end: number;
}

/**
 * Read the file's header block: the first documentation comment, when a blank
 * line or a second block separates it from the first declaration, or when the first
 * statement is an import, which carries no documentation of its own. Otherwise the
 * block documents the declaration, and the module has none.
 *
 * @param file - The parsed source file.
 * @returns The module's comment and the offset declarations start looking after.
 */
export function moduleComment(file: ts.SourceFile): ModuleComment {
	let text = file.getFullText();
	let ranges = (ts.getLeadingCommentRanges(text, 0) ?? []).filter((range) =>
		text.startsWith("/**", range.pos),
	);

	let [first] = ranges;
	if (!first) return { comment: null, end: 0 };

	let statement = file.statements.at(0);
	let follows = text.slice(first.end, statement?.getStart() ?? text.length);
	let separated =
		ranges.length > 1 ||
		/\n[ \t]*\n/.test(follows) ||
		statement === undefined ||
		ts.isImportDeclaration(statement);
	if (!separated) return { comment: null, end: 0 };

	return { comment: parseComment(text.slice(first.pos, first.end)), end: first.end };
}

/**
 * Read the documentation comment written directly above a node.
 *
 * The last block wins, so a node preceded by a license header and its own
 * documentation keeps the one closest to it.
 *
 * @param node - Node whose comment to read.
 * @param after - Offset from `moduleComment`, below which a block belongs to the module.
 * @returns The parsed comment, or `null` when the node carries none.
 */
export function leadingComment(node: ts.Node, after: number): DocComment | null {
	let text = node.getSourceFile().getFullText();
	let ranges = (ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []).filter(
		(range) => range.pos >= after && text.startsWith("/**", range.pos),
	);

	let last = ranges.at(-1);
	return last ? parseComment(text.slice(last.pos, last.end)) : null;
}

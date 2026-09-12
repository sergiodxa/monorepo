/**
 * The source cut into the lines the block phase walks, each carrying where its
 * first character sits in the file. Keeping the file's own coordinates on every
 * line is what lets a body parsed past a frontmatter block still name real lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../../index.js";

/** One source line, stripped of its terminator, located in the file it came from. */
export interface Line {
	text: string;
	/** 1-based line in the source. */
	line: number;
	/** 1-based column {@link Line.text}'s first character sits at. */
	columnBase: number;
	/** 0-based offset in the source of {@link Line.text}'s first character. */
	offset: number;
}

/** Every terminator CommonMark recognizes, so a file written on any platform splits the same. */
const LINE_BREAK = /\r\n|\n|\r/g;

/**
 * Cuts the body into lines, mapping each back to the whole file. A final
 * terminator ends the last line rather than opening an empty one, which is what
 * keeps a file that ends in a newline from growing a trailing blank line.
 *
 * @param source - The whole file
 * @param start - Where the body begins, which is past any frontmatter block
 * @returns The body's lines, in source order
 */
export function splitLines(source: string, start: Markdown.Point): Line[] {
	let body = source.slice(start.offset).replace(/\0/g, "�");
	let lines: Line[] = [];
	let index = 0;
	let match: RegExpExecArray | null;

	LINE_BREAK.lastIndex = 0;

	while ((match = LINE_BREAK.exec(body)) !== null) {
		lines.push(makeLine(body.slice(index, match.index), lines.length, index, start));
		index = match.index + match[0].length;
		LINE_BREAK.lastIndex = index;
	}

	if (index < body.length) lines.push(makeLine(body.slice(index), lines.length, index, start));

	return lines;
}

/**
 * The first body line may begin mid-line when a frontmatter block ends without a
 * terminator, so only that one inherits the body's own column.
 *
 * @param text - The line's text
 * @param ordinal - How many lines came before it
 * @param index - Where the line begins inside the body
 * @param start - Where the body begins in the file
 * @returns The line, located in the file
 */
function makeLine(text: string, ordinal: number, index: number, start: Markdown.Point): Line {
	return {
		text,
		line: start.line + ordinal,
		columnBase: ordinal === 0 ? start.column : 1,
		offset: start.offset + index,
	};
}

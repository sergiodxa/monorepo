/**
 * Source-text bookkeeping for `.spec` files: file wrappers, spans, and
 * positions. The lexer, parser, and diagnostics all share these shapes so
 * every failure can point at the exact statement that produced it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A caret location inside a source file, 1-indexed the way editors display. */
export interface Position {
	/** 1-indexed line number. */
	line: number;
	/** 1-indexed column, counted in UTF-16 code units. */
	column: number;
}

/** A half-open range of source text (`start` inclusive, `end` exclusive). */
export interface Span {
	/** Offset of the first character, 0-indexed into the file text. */
	start: number;
	/** Offset one past the last character. */
	end: number;
}

/** A `.spec` file's full text plus the path diagnostics report it under. */
export interface SourceFile {
	/** Path as handed to the loader; relative paths stay relative. */
	path: string;
	/** The complete text of the file. */
	text: string;
}

/**
 * Translate a text offset into a line/column position, for rendering
 * diagnostics. Offsets past the end of the file clamp to the last position.
 *
 * @param source - The file the offset points into.
 * @param offset - 0-indexed character offset, e.g. a `Span`'s `start`.
 * @returns The 1-indexed line and column of that offset.
 */
export function positionAt(source: SourceFile, offset: number): Position {
	let line = 1;
	let column = 1;
	let end = Math.min(offset, source.text.length);
	for (let index = 0; index < end; index++) {
		if (source.text[index] === "\n") {
			line += 1;
			column = 1;
		} else {
			column += 1;
		}
	}
	return { line, column };
}

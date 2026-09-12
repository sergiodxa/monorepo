/**
 * Maps an index inside a leaf block's collected text back to the line and column
 * it was written on. Container prefixes and fence indentation are stripped before
 * inline parsing, so without this every inline node's position would be a guess.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/** One source line a leaf collected, and where its first character sits in the file. */
export interface Chunk {
	/** The line's text, with any container prefix already removed. */
	text: string;
	/** 1-based line in the source. */
	line: number;
	/** 1-based column in the source where {@link Chunk.text} starts. */
	column: number;
	/** 0-based offset in the source where {@link Chunk.text} starts. */
	offset: number;
}

/**
 * A leaf block's text together with the source coordinates each line came from.
 * Lines join with a newline, which is the text the inline phase reads.
 */
export class SourceText {
	/** Where each chunk begins inside {@link SourceText.value}. */
	#starts: number[] = [];

	#chunks: Chunk[];

	/** The text the inline phase parses: every chunk, joined by newlines. */
	readonly value: string;

	/**
	 * @param chunks - The lines this leaf collected, in source order
	 */
	constructor(chunks: Chunk[]) {
		this.#chunks = chunks;

		let parts: string[] = [];
		let cursor = 0;

		for (let chunk of chunks) {
			this.#starts.push(cursor);
			parts.push(chunk.text);
			cursor += chunk.text.length + 1;
		}

		this.value = parts.join("\n");
	}

	/**
	 * Locates an index of {@link SourceText.value} in the original file. An index
	 * past the end clamps to the last chunk, so a node ending at the boundary
	 * still reports a point inside the document.
	 *
	 * @param index - Index into {@link SourceText.value}
	 * @returns The point in the source that index was written at
	 */
	point(index: number): Markdown.Point {
		let target = Math.max(0, Math.min(index, this.value.length));
		let at = 0;

		for (let i = 1; i < this.#starts.length; i++) {
			let start = this.#starts[i];
			if (start === undefined || start > target) break;
			at = i;
		}

		let chunk = this.#chunks[at];
		if (!chunk) return { line: 1, column: 1, offset: 0 };

		let start = this.#starts[at] ?? 0;
		let column = Math.min(target - start, chunk.text.length);

		return {
			line: chunk.line,
			column: chunk.column + column,
			offset: chunk.offset + column,
		};
	}

	/**
	 * @param start - Index into {@link SourceText.value} where the node begins
	 * @param end - Index one past the node's last character
	 * @returns The span in the source those indices cover
	 */
	position(start: number, end: number): Markdown.Position {
		return { start: this.point(start), end: this.point(end) };
	}
}

/**
 * The zero-width span at one point, for a node the source wrote nothing for —
 * a softbreak the block phase inserted, or a node a visitor built by hand.
 *
 * @param point - Where the empty span sits
 * @returns A position whose start and end are that point
 */
export function emptyPosition(point: Markdown.Point): Markdown.Position {
	return { start: point, end: point };
}

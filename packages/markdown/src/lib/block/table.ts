/**
 * A table row cut into cells, and the delimiter row read for alignment. Pipes are
 * the only structure a row has, so escaping is the one thing that decides whether
 * a `|` divides two cells or belongs inside one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../../index.js";

/** One cell's text, located inside the row it was cut from. */
export interface Cell {
	/** The cell's content, trimmed, with `\|` resolved to a literal pipe. */
	text: string;
	/** Index in the row where {@link Cell.text} begins. */
	start: number;
}

/** What a delimiter cell asks for, `null` where it asked for nothing. */
export type Alignment = Markdown.Table["align"][number];

/** A delimiter cell: hyphens, with a colon on either side asking for an alignment. */
const DELIMITER_CELL = /^(:?)-+(:?)$/;

/**
 * Cuts a row into cells. A leading pipe opens the row rather than an empty first
 * cell, and a trailing one closes it, so `| a | b |` and `a | b` both read as two.
 *
 * @param row - One row's text, without its container prefix
 * @returns The row's cells, in order
 */
export function splitCells(row: string): Cell[] {
	let limit = row.length;
	while (limit > 0 && /\s/.test(row.charAt(limit - 1))) limit -= 1;

	let index = 0;
	while (index < limit && /[ \t]/.test(row.charAt(index))) index += 1;
	if (row.charAt(index) === "|") index += 1;

	let segments: Cell[] = [];
	let text = "";
	let start = index;
	let closed = false;

	while (index < limit) {
		let char = row.charAt(index);

		if (char === "\\" && row.charAt(index + 1) === "|") {
			text += "|";
			index += 2;
			closed = false;
			continue;
		}

		if (char === "|") {
			segments.push({ text, start });
			text = "";
			index += 1;
			start = index;
			closed = true;
			continue;
		}

		text += char;
		index += 1;
		closed = false;
	}

	segments.push({ text, start });
	if (closed && segments.length > 1 && text.trim() === "") segments.pop();

	return segments.map(trimCell);
}

/**
 * Reads a delimiter row. A pipe is required, which is what keeps `---` under a
 * line of prose a setext heading rather than a one-column table.
 *
 * @param row - The candidate delimiter row's text
 * @returns One alignment per column, or `null` when the row is ordinary content
 */
export function readDelimiterRow(row: string): Alignment[] | null {
	if (!hasPipe(row)) return null;

	let cells = splitCells(row);
	if (cells.length === 0) return null;

	let align: Alignment[] = [];

	for (let cell of cells) {
		let match = DELIMITER_CELL.exec(cell.text);
		if (!match) return null;
		align.push(readAlignment(match[1] === ":", match[2] === ":"));
	}

	return align;
}

/** Which side the colons sit on, which is the whole of what a delimiter cell says. */
function readAlignment(left: boolean, right: boolean): Alignment {
	if (left && right) return "center";
	if (left) return "left";
	if (right) return "right";
	return null;
}

/** Whether the row divides at all, counting only pipes a backslash left alone. */
function hasPipe(row: string): boolean {
	for (let index = 0; index < row.length; index++) {
		let char = row.charAt(index);
		if (char === "\\") {
			index += 1;
			continue;
		}
		if (char === "|") return true;
	}

	return false;
}

/** Surrounding whitespace belongs to the row, so it moves the cell's start with it. */
function trimCell(cell: Cell): Cell {
	let lead = 0;
	while (lead < cell.text.length && /\s/.test(cell.text.charAt(lead))) lead += 1;

	return { text: cell.text.trim(), start: cell.start + lead };
}

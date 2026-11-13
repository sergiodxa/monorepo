/**
 * Reads and writes a cited range of source lines in the two forms an address carries it:
 * the `?L=3-8` query a server paints without script, and the `#L3-L8` fragment a script
 * keeps in the address bar, so both sides agree on what a link selects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A range of lines, counted from 1, `start` never after `end`. */
export interface LineRange {
	start: number;
	end: number;
}

/**
 * Reads a line range from a query value (`3-8`, `3`) or a fragment (`#L3-L8`, `L3`), in
 * either order. Anything else, a line below 1 included, reads as no range.
 *
 * @param value A `?L=` value or a location hash.
 * @returns The range, or `undefined` when the value names none.
 * @example parseLineRange(url.searchParams.get("L")) // { start: 3, end: 8 } for ?L=3-8
 */
export function parseLineRange(value: string | null | undefined): LineRange | undefined {
	let match = /^#?L?(\d+)(?:-L?(\d+))?$/i.exec((value ?? "").trim());
	if (match === null) return undefined;
	let first = Number(match[1]);
	let second = match[2] === undefined ? first : Number(match[2]);
	if (first < 1 || second < 1) return undefined;
	return { start: Math.min(first, second), end: Math.max(first, second) };
}

/**
 * Writes a range as a `?L=` value: `3-8`, or `3` for one line.
 *
 * @param range The lines to cite.
 * @returns The query value.
 */
export function lineRangeQuery(range: LineRange): string {
	return range.start === range.end ? String(range.start) : `${range.start}-${range.end}`;
}

/**
 * Writes a range as a fragment: `#L3-L8`, or `#L3` for one line, which the line's own
 * anchor answers to.
 *
 * @param range The lines to cite.
 * @returns The fragment, `#` included.
 */
export function lineRangeHash(range: LineRange): string {
	return range.start === range.end ? `#L${range.start}` : `#L${range.start}-L${range.end}`;
}

/**
 * The address a line's number links to without script: the line as a `?L=` query, so the
 * server paints it, and its anchor, so the browser scrolls to it. Other query parameters
 * of `base` are kept.
 *
 * @param line The line, counted from 1.
 * @param base The page's own address, relative or absolute.
 * @returns A link to the line on the same page.
 * @example lineLink(10, "/blob/main/app.ts?plain=1") // "/blob/main/app.ts?plain=1&L=10#L10"
 */
export function lineLink(line: number, base = ""): string {
	let [path = "", query = ""] = base.split("#")[0]!.split("?");
	let params = new URLSearchParams(query);
	params.set("L", String(line));
	return `${path}?${params.toString()}#L${line}`;
}

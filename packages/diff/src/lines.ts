/**
 * One side of a line diff as offsets into its text, with every line interned to an integer
 * shared across both sides. Lines are hashed straight from the text, so the diff allocates a
 * string only for the lines it outputs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One text split into lines, each `text.slice(starts[i], ends[i])` without its newline. */
export interface Side {
	text: string;
	starts: Int32Array;
	ends: Int32Array;
	length: number;
	/** The text ends without a newline, so its last line differs from the same text with one. */
	noNewline: boolean;
	/** Line ids: two lines share an id exactly when their text and newline both match. */
	ids: Int32Array;
}

/** FNV-1a's offset basis: the hash of an empty line. */
const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a's 32-bit prime, which spreads each character across the whole hash. */
const FNV_PRIME = 16777619;

/** Splits text at `\n`; a `\r` before it stays part of the line. */
export function split(text: string): Side {
	let starts = new Int32Array(Math.max(16, text.length >> 5));
	let length = 0;
	let start = 0;
	while (start < text.length) {
		if (length === starts.length) {
			let grown = new Int32Array(starts.length * 2);
			grown.set(starts);
			starts = grown;
		}
		starts[length++] = start;
		let end = text.indexOf("\n", start);
		start = end === -1 ? text.length + 1 : end + 1;
	}
	starts = starts.slice(0, length);
	let ends = new Int32Array(length);
	for (let i = 0; i < length - 1; i++) ends[i] = starts[i + 1]! - 1;
	let noNewline = text.length > 0 && text.charCodeAt(text.length - 1) !== 10;
	if (length > 0) ends[length - 1] = noNewline ? text.length : text.length - 1;
	return { text, starts, ends, length, noNewline, ids: new Int32Array(length) };
}

/** The text of line `i`, without its newline. */
export function lineText(side: Side, i: number): string {
	return side.text.slice(side.starts[i], side.ends[i]);
}

/** Whether line `i` is the last of a text that ends without a newline. */
export function lacksNewline(side: Side, i: number): boolean {
	return side.noNewline && i === side.length - 1;
}

/** Hashes line `i` of `side`, folding in whether it ends without a newline. */
function hashOf(side: Side, i: number): number {
	let { text } = side;
	let hash = FNV_OFFSET | 0;
	for (let k = side.starts[i]!, end = side.ends[i]!; k < end; k++) {
		hash = Math.imul(hash ^ text.charCodeAt(k), FNV_PRIME);
	}
	return lacksNewline(side, i) ? Math.imul(hash ^ 0xffff, FNV_PRIME) : hash;
}

/** Whether line `i` of `left` and line `j` of `right` are the same line, newline included. */
function sameLine(left: Side, i: number, right: Side, j: number): boolean {
	let ls = left.starts[i]!;
	let le = left.ends[i]!;
	let rs = right.starts[j]!;
	let re = right.ends[j]!;
	return (
		le - ls === re - rs &&
		lacksNewline(left, i) === lacksNewline(right, j) &&
		left.text.slice(ls, le) === right.text.slice(rs, re)
	);
}

/** How far ahead of the current guess a matched line is looked for before jumping. */
const RESYNC_WINDOW = 16;

/**
 * The old line to compare the next new line with, after a new line matched `id`: the line
 * after the nearest occurrence of `id` just ahead of the guess, or after its first occurrence.
 */
function resync(ids: Int32Array, guess: number, id: number, first: number): number {
	let limit = Math.min(ids.length, guess + RESYNC_WINDOW);
	for (let k = guess; k < limit; k++) if (ids[k] === id) return k + 1;
	return first + 1;
}

/** The longest run of lines compared in one go while the new side follows the old. */
const MAX_RUN = 256;

/** An open-addressing table from line hash to line id, with each id's first occurrence. */
interface Table {
	slots: Int32Array;
	mask: number;
	hashes: Int32Array;
	firstLine: Int32Array;
	firstSide: Side[];
	count: number;
}

/**
 * Whether lines `a[i, i + k)` equal lines `b[j, j + k)`. Equal text starting at line starts
 * puts the newlines in the same places, so one comparison covers the whole run.
 */
function sameRun(a: Side, i: number, b: Side, j: number, k: number): boolean {
	let last = k - 1;
	if (lacksNewline(a, i + last) !== lacksNewline(b, j + last)) return false;
	let as = a.starts[i]!;
	let ae = a.ends[i + last]!;
	let bs = b.starts[j]!;
	let be = b.ends[j + last]!;
	return ae - as === be - bs && a.text.slice(as, ae) === b.text.slice(bs, be);
}

/** Finds the id of line `i` of `side`, adding the line to the table when it is new. */
function lookup(table: Table, side: Side, i: number): number {
	let hash = hashOf(side, i);
	let slot = hash & table.mask;
	for (let probe = table.slots[slot]!; probe !== 0; probe = table.slots[slot]!) {
		let candidate = probe - 1;
		if (
			table.hashes[candidate] === hash &&
			sameLine(table.firstSide[candidate]!, table.firstLine[candidate]!, side, i)
		) {
			return candidate;
		}
		slot = (slot + 1) & table.mask;
	}
	let id = table.count++;
	table.hashes[id] = hash;
	table.firstSide.push(side);
	table.firstLine[id] = i;
	table.slots[slot] = id + 1;
	return id;
}

/**
 * Interns every line of both sides into `ids`. Old lines are hashed; new lines are first
 * compared, in runs that double while they keep matching, with the old lines that follow the
 * last match, so an unchanged stretch costs a few comparisons and only changed lines are hashed.
 *
 * @returns How many distinct lines there are; ids run from 0 to this count minus one.
 */
export function intern(a: Side, b: Side): number {
	let capacity = 16;
	while (capacity < a.length * 2 + b.length) capacity *= 2;
	let table: Table = {
		slots: new Int32Array(capacity),
		mask: capacity - 1,
		hashes: new Int32Array(a.length + b.length),
		firstLine: new Int32Array(a.length + b.length),
		firstSide: [],
		count: 0,
	};
	for (let i = 0; i < a.length; i++) a.ids[i] = lookup(table, a, i);
	let guess = 0;
	let run = 1;
	let i = 0;
	while (i < b.length) {
		let k = Math.min(run, a.length - guess, b.length - i);
		if (k > 0 && sameRun(a, guess, b, i, k)) {
			b.ids.set(a.ids.subarray(guess, guess + k), i);
			i += k;
			guess += k;
			run = Math.min(run * 2, MAX_RUN);
		} else if (k > 1) {
			run = k >> 1;
		} else {
			let id = lookup(table, b, i);
			b.ids[i++] = id;
			run = 1;
			if (table.firstSide[id] === a) guess = resync(a.ids, guess, id, table.firstLine[id]!);
		}
	}
	return table.count;
}

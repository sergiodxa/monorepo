/**
 * The line diff: split both texts, intern every line to an integer, align them, slide each
 * change to where a reader expects it, and cut the result into hunks with context, the same
 * output `git diff --histogram` prints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Rediff } from "./compact.js";
import type { Side } from "./lines.js";
import type { Budget } from "./myers.js";
import type { DiffOptions, Hunk, Line, LineDiff } from "./types.js";

import { compact } from "./compact.js";
import { histogram } from "./histogram.js";
import { intern, lacksNewline, lineText, split } from "./lines.js";
import { myersDiscarding } from "./myers.js";
import { markWords } from "./words.js";

/** The default comparison budget, which keeps the slowest input to under a second of work. */
const DEFAULT_MAX_COST = 20_000_000;

/** Git cuts a hunk's section heading at this many bytes. */
const MAX_SECTION_BYTES = 80;

/**
 * Marks the changed lines of both sides, offset by one as `compact` expects. Myers runs on what
 * lies between the shared prefix and suffix; histogram sees the whole files, because a line's
 * rarity counts its occurrences in the shared ends too, and that picks git's anchors.
 *
 * @returns Both sides' change marks and how many distinct lines the two sides hold.
 */
function align(
	a: Side,
	b: Side,
	options: DiffOptions,
	budget: Budget,
): [Uint8Array, Uint8Array, number] {
	let n = a.length;
	let m = b.length;
	let changedA = new Uint8Array(n + 2);
	let changedB = new Uint8Array(m + 2);
	if (n <= 1 && m <= 1) {
		let same =
			n === 1 && m === 1 && lineText(a, 0) === lineText(b, 0) && a.noNewline === b.noNewline;
		if (!same) {
			changedA.fill(1, 1, n + 1);
			changedB.fill(1, 1, m + 1);
		}
		return [changedA, changedB, 0];
	}
	let distinct = intern(a, b);
	let idsA = a.ids;
	let idsB = b.ids;
	let prefix = 0;
	while (prefix < n && prefix < m && idsA[prefix] === idsB[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < n - prefix &&
		suffix < m - prefix &&
		idsA[n - 1 - suffix] === idsB[m - 1 - suffix]
	) {
		suffix++;
	}
	let aHi = n - suffix;
	let bHi = m - suffix;
	if (prefix === aHi || prefix === bHi) {
		changedA.fill(1, prefix + 1, aHi + 1);
		changedB.fill(1, prefix + 1, bHi + 1);
	} else if (options.algorithm === "myers") {
		let seen = new Uint8Array(distinct);
		myersDiscarding(idsA, prefix, aHi, idsB, prefix, bHi, changedA, changedB, budget, seen);
	} else {
		histogram(idsA, 0, n, idsB, 0, m, distinct, changedA, changedB, budget);
	}
	return [changedA, changedB, distinct];
}

/**
 * Builds the re-alignment `compact` runs on histogram output: a block that grew while sliding
 * may now share lines with the block facing it, which a minimal Myers pass recovers.
 */
function rediffer(
	a: Side,
	b: Side,
	changedA: Uint8Array,
	changedB: Uint8Array,
	distinct: number,
	budget: Budget,
): Rediff {
	let seen: Uint8Array | undefined;
	return (start, end, otherStart, otherEnd) => {
		seen ??= new Uint8Array(distinct);
		changedA.fill(0, start + 1, end + 1);
		changedB.fill(0, otherStart + 1, otherEnd + 1);
		myersDiscarding(
			a.ids,
			start,
			end,
			b.ids,
			otherStart,
			otherEnd,
			changedA,
			changedB,
			budget,
			seen,
		);
	};
}

/** A run of changes: old lines `[i1, i2)` replaced by new lines `[j1, j2)`. */
interface Change {
	i1: number;
	i2: number;
	j1: number;
	j2: number;
}

/** Collects the runs of changes, in order, from the change marks of both sides. */
function changesOf(n: number, m: number, changedA: Uint8Array, changedB: Uint8Array): Change[] {
	let changes: Change[] = [];
	let i = 0;
	let j = 0;
	while (i < n || j < m) {
		if (changedA[i + 1] || changedB[j + 1]) {
			let i1 = i;
			let j1 = j;
			while (changedA[i + 1]) i++;
			while (changedB[j + 1]) j++;
			changes.push({ i1, i2: i, j1, j2: j });
		} else {
			i++;
			j++;
		}
	}
	return changes;
}

/** Whether git's default section rule accepts a line: it starts with a letter, `_` or `$`. */
function isSection(side: Side, i: number): boolean {
	if (side.starts[i] === side.ends[i]) return false;
	let c = side.text.charCodeAt(side.starts[i]!);
	return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95 || c === 36;
}

/** How many bytes UTF-8 spends on one code point. */
function utf8Length(point: number): number {
	if (point < 0x80) return 1;
	if (point < 0x800) return 2;
	return point < 0x10000 ? 3 : 4;
}

/**
 * Cuts a section heading to its first 80 UTF-8 bytes, as git does, dropping a character that
 * would straddle the cut, then trims trailing whitespace.
 */
function sectionOf(line: string): string {
	let bytes = 0;
	let end = 0;
	while (end < line.length) {
		let c = line.codePointAt(end)!;
		let size = utf8Length(c);
		if (bytes + size > MAX_SECTION_BYTES) break;
		bytes += size;
		end += c > 0xffff ? 2 : 1;
	}
	return line.slice(0, end).trimEnd();
}

/** Builds hunk line `i` of `side`, numbered on the sides it belongs to. */
function lineOf(kind: Line["kind"], side: Side, i: number, old?: number, next?: number): Line {
	let line: Line = { kind, text: lineText(side, i) };
	if (old !== undefined) line.old = old;
	if (next !== undefined) line.new = next;
	if (lacksNewline(side, i)) line.noNewline = true;
	return line;
}

/** Fills a hunk's lines by walking old `[i, i2)` and new `[j, j2)` side by side. */
function hunkLines(
	a: Side,
	b: Side,
	changedA: Uint8Array,
	changedB: Uint8Array,
	from: [number, number],
	to: [number, number],
): Line[] {
	let lines: Line[] = [];
	let [i, j] = from;
	let [i2, j2] = to;
	while (i < i2 || j < j2) {
		if (i < i2 && changedA[i + 1]) {
			lines.push(lineOf("del", a, i, i + 1));
			i++;
		} else if (j < j2 && changedB[j + 1]) {
			lines.push(lineOf("add", b, j, undefined, j + 1));
			j++;
		} else {
			lines.push(lineOf("context", a, i, i + 1, j + 1));
			i++;
			j++;
		}
	}
	return lines;
}

/**
 * Cuts changes into hunks. Changes at most `2 * context` lines apart share a hunk, and each hunk
 * carries the nearest old line before it that git's section rule accepts.
 */
function hunksOf(
	a: Side,
	b: Side,
	changedA: Uint8Array,
	changedB: Uint8Array,
	context: number,
): Hunk[] {
	let changes = changesOf(a.length, b.length, changedA, changedB);
	let hunks: Hunk[] = [];
	let section: string | undefined;
	let searchedTo = -1;
	let c = 0;
	while (c < changes.length) {
		let first = changes[c]!;
		let last = first;
		while (c + 1 < changes.length && changes[c + 1]!.i1 - last.i2 <= 2 * context) {
			c++;
			last = changes[c]!;
		}
		c++;
		let lead = Math.min(context, first.i1);
		let trail = Math.min(context, a.length - last.i2);
		let s1 = first.i1 - lead;
		let s2 = first.j1 - lead;
		let e1 = last.i2 + trail;
		let e2 = last.j2 + trail;
		for (let l = s1 - 1; l > searchedTo; l--) {
			if (isSection(a, l)) {
				section = sectionOf(lineText(a, l));
				break;
			}
		}
		searchedTo = Math.max(searchedTo, s1 - 1);
		let hunk: Hunk = {
			oldStart: e1 > s1 ? s1 + 1 : s1,
			oldLines: e1 - s1,
			newStart: e2 > s2 ? s2 + 1 : s2,
			newLines: e2 - s2,
			lines: hunkLines(a, b, changedA, changedB, [s1, s2], [e1, e2]),
		};
		if (section) hunk.section = section;
		hunks.push(hunk);
	}
	return hunks;
}

/**
 * Diffs two texts line by line into hunks. Lines end at `\n`; a `\r` before it stays part of
 * the line, and a side that ends without a newline marks its last line `noNewline`.
 *
 * @example diffLines("a\nb\n", "a\nc\n").hunks[0].lines; // context a, del b, add c
 * @example diffLines(before, after, { algorithm: "myers", context: 0, words: false });
 */
export function diffLines(oldText: string, newText: string, options: DiffOptions = {}): LineDiff {
	let a = split(oldText);
	let b = split(newText);
	let budget: Budget = { remaining: options.maxCost ?? DEFAULT_MAX_COST, approximate: false };
	let [changedA, changedB, distinct] = align(a, b, options, budget);
	let rediff =
		options.algorithm === "myers"
			? undefined
			: rediffer(a, b, changedA, changedB, distinct, budget);
	compact(a, changedA, b.length, changedB, rediff);
	compact(b, changedB, a.length, changedA, rediff && ((s, e, os, oe) => rediff(os, oe, s, e)));
	let hunks = hunksOf(a, b, changedA, changedB, Math.max(0, options.context ?? 3));
	if (options.words !== false) for (let hunk of hunks) markWords(hunk.lines);
	let additions = 0;
	let deletions = 0;
	for (let i = 1; i <= b.length; i++) additions += changedB[i]!;
	for (let i = 1; i <= a.length; i++) deletions += changedA[i]!;
	return { hunks, additions, deletions, approximate: budget.approximate };
}

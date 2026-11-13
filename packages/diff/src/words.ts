/**
 * Word diff of paired lines: split both into identifier, number, whitespace and punctuation
 * tokens, align the tokens with Myers, and report the changed spans as character offsets.
 * Pairs too different to mark come back unmarked, as wholly changed lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Budget } from "./myers.js";
import type { Line, WordDiff, WordRange } from "./types.js";

import { myers } from "./myers.js";

/** Lines longer than this are shown as wholly changed, which is what a reader scans anyway. */
const MAX_LINE_LENGTH = 1000;

/** Comparison steps one pair may spend before it is shown as wholly changed. */
const MAX_PAIR_COST = 200_000;

/** Letters, digits, `_`, `$` and non-ASCII text: a run of them is one identifier or number. */
const WORD = 1;

/** Spaces, tabs and other blanks: a run of them is one token. */
const SPACE = 2;

/** Anything else: each character is a token of its own, so a bracket change stays small. */
const PUNCTUATION = 3;

/** Classifies a UTF-16 code unit; letters, digits, `_`, `$` and every non-ASCII unit form words. */
function classOf(c: number): number {
	if (c === 32 || c === 9 || c === 13 || c === 11 || c === 12) return SPACE;
	if (
		(c >= 97 && c <= 122) ||
		(c >= 65 && c <= 90) ||
		(c >= 48 && c <= 57) ||
		c === 95 ||
		c === 36 ||
		c >= 128
	) {
		return WORD;
	}
	return PUNCTUATION;
}

/** Whether a token starts at offset `at`: a class change, punctuation, or either end. */
function isBoundary(line: string, at: number): boolean {
	if (at === 0 || at === line.length) return true;
	let before = classOf(line.charCodeAt(at - 1));
	let after = classOf(line.charCodeAt(at));
	return before !== after || after === PUNCTUATION;
}

/** Offset just past the token starting at `at`. */
function tokenEnd(line: string, at: number, end: number): number {
	let kind = classOf(line.charCodeAt(at));
	let i = at + 1;
	if (kind !== PUNCTUATION) while (i < end && classOf(line.charCodeAt(i)) === kind) i++;
	return i;
}

/** Counts the tokens of `line[from, to)`, a span that starts and ends on token boundaries. */
function countTokens(line: string, from: number, to: number): number {
	let count = 0;
	for (let i = from; i < to; i = tokenEnd(line, i, to)) count++;
	return count;
}

/**
 * Splits `line[from, to)` into tokens, interning each through `ids`.
 *
 * @returns The token ids and the offset each token starts at, with `to` appended.
 */
function tokenize(
	line: string,
	from: number,
	to: number,
	ids: Map<string, number>,
): [Int32Array, Int32Array] {
	let starts: number[] = [];
	for (let i = from; i < to; i = tokenEnd(line, i, to)) starts.push(i);
	starts.push(to);
	let tokens = new Int32Array(starts.length - 1);
	for (let t = 0; t < tokens.length; t++) {
		let text = line.slice(starts[t], starts[t + 1]);
		let id = ids.get(text);
		if (id === undefined) {
			id = ids.size;
			ids.set(text, id);
		}
		tokens[t] = id;
	}
	return [tokens, Int32Array.from(starts)];
}

/**
 * The lengths of the text both lines share at the start and at the end, each cut back to a
 * token boundary on both lines, so the shared ends tokenize the same way on either side.
 */
function sharedEnds(oldLine: string, newLine: string): [number, number] {
	let shortest = Math.min(oldLine.length, newLine.length);
	let prefix = 0;
	while (prefix < shortest && oldLine.charCodeAt(prefix) === newLine.charCodeAt(prefix)) prefix++;
	while (prefix > 0 && !(isBoundary(oldLine, prefix) && isBoundary(newLine, prefix))) prefix--;
	let suffix = 0;
	let oldEnd = oldLine.length - 1;
	let newEnd = newLine.length - 1;
	while (
		suffix < shortest - prefix &&
		oldLine.charCodeAt(oldEnd - suffix) === newLine.charCodeAt(newEnd - suffix)
	) {
		suffix++;
	}
	while (
		suffix > 0 &&
		!(isBoundary(oldLine, oldLine.length - suffix) && isBoundary(newLine, newLine.length - suffix))
	) {
		suffix--;
	}
	return [prefix, suffix];
}

/**
 * Turns per-token change marks into character ranges. Runs of changed tokens separated by a
 * single unchanged whitespace token join into one range, so a changed phrase reads as one mark.
 */
function rangesOf(line: string, starts: Int32Array, changed: Uint8Array): WordRange[] {
	let ranges: WordRange[] = [];
	let count = starts.length - 1;
	let t = 0;
	while (t < count) {
		if (!changed[t + 1]) {
			t++;
			continue;
		}
		let first = t;
		while (t < count && changed[t + 1]) t++;
		let start = starts[first]!;
		let end = starts[t]!;
		let last = ranges.at(-1);
		if (last && last[1] === starts[first - 1] && isBlank(line, last[1], start)) last[1] = end;
		else ranges.push([start, end]);
	}
	return ranges;
}

/** Whether `line[start, end)` is only spaces and tabs. */
function isBlank(line: string, start: number, end: number): boolean {
	for (let i = start; i < end; i++) if (classOf(line.charCodeAt(i)) !== SPACE) return false;
	return true;
}

/**
 * Diffs two paired lines word by word.
 *
 * @returns The removed spans of `oldLine` and the added spans of `newLine`, or `undefined` when
 * either line is over 1,000 characters or the two share less than half their tokens, in which
 * case the whole line is the change.
 * @example diffWords("let a = 1;", "let b = 1;"); // { old: [[4, 5]], new: [[4, 5]] }
 */
export function diffWords(oldLine: string, newLine: string): WordDiff | undefined {
	if (oldLine.length > MAX_LINE_LENGTH || newLine.length > MAX_LINE_LENGTH) return undefined;
	let [prefix, suffix] = sharedEnds(oldLine, newLine);
	let shared =
		countTokens(oldLine, 0, prefix) + countTokens(oldLine, oldLine.length - suffix, oldLine.length);
	let ids = new Map<string, number>();
	let [oldTokens, oldStarts] = tokenize(oldLine, prefix, oldLine.length - suffix, ids);
	let [newTokens, newStarts] = tokenize(newLine, prefix, newLine.length - suffix, ids);
	let oldChanged = new Uint8Array(oldTokens.length + 2);
	let newChanged = new Uint8Array(newTokens.length + 2);
	let budget: Budget = { remaining: MAX_PAIR_COST, approximate: false };
	myers(
		oldTokens,
		0,
		oldTokens.length,
		newTokens,
		0,
		newTokens.length,
		oldChanged,
		newChanged,
		budget,
	);
	if (budget.approximate) return undefined;
	let common = shared;
	for (let t = 0; t < oldTokens.length; t++) if (!oldChanged[t + 1]) common++;
	if (common * 2 < shared + Math.max(oldTokens.length, newTokens.length)) return undefined;
	return {
		old: rangesOf(oldLine, oldStarts, oldChanged),
		new: rangesOf(newLine, newStarts, newChanged),
	};
}

/**
 * Pairs each run of deleted lines with the run of added lines right after it, first with
 * first, and sets `words` on both lines of every pair the word diff marks. Lines without a
 * pair, or whose pair is skipped, keep no `words`.
 */
export function markWords(lines: Line[]): void {
	let i = 0;
	while (i < lines.length) {
		if (lines[i]!.kind !== "del") {
			i++;
			continue;
		}
		let delStart = i;
		while (i < lines.length && lines[i]!.kind === "del") i++;
		let addStart = i;
		while (i < lines.length && lines[i]!.kind === "add") i++;
		let pairs = Math.min(addStart - delStart, i - addStart);
		for (let p = 0; p < pairs; p++) {
			let del = lines[delStart + p]!;
			let add = lines[addStart + p]!;
			let words = diffWords(del.text, add.text);
			if (words) {
				del.words = words.old;
				add.words = words.new;
			}
		}
	}
}

/**
 * Slides each block of changes to the position a reader expects, as git does after aligning:
 * merge blocks that touch, line a block up with its counterpart on the other side, and
 * otherwise place it where the indentation says a block of code starts and ends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Side } from "./lines.js";

/** Leading whitespace counts up to this width. */
const MAX_INDENT = 200;

/** Blank lines count up to this many when measuring around a split. */
const MAX_BLANKS = 20;

/** The furthest a block slides while searching for the best indentation split. */
const MAX_SLIDING = 100;

/**
 * The indentation heuristic's weights, tuned by git against a corpus of human-drawn diffs; a
 * difference in effective indentation outweighs every penalty but the end of the file.
 */
const WEIGHTS = {
	startOfFile: 1,
	endOfFile: 21,
	totalBlank: -30,
	postBlank: 6,
	relativeIndent: -4,
	relativeIndentWithBlank: 10,
	relativeOutdent: 24,
	relativeOutdentWithBlank: 17,
	relativeDedent: 23,
	relativeDedentWithBlank: 17,
	indent: 60,
};

/** One run of changed lines `[start, end)` in a file; empty when `start === end`. */
interface Group {
	start: number;
	end: number;
}

/** The scores of one candidate split, summed over the block's two edges. */
interface Score {
	effectiveIndent: number;
	penalty: number;
}

/**
 * Width of a line's leading whitespace, with tabs to the next multiple of eight.
 *
 * @returns -1 for a line that is only whitespace.
 */
function indentOf(side: Side, line: number): number {
	let { text } = side;
	let width = 0;
	for (let i = side.starts[line]!, end = side.ends[line]!; i < end; i++) {
		let c = text.charCodeAt(i);
		if (c === 32) width += 1;
		else if (c === 9) width += 8 - (width % 8);
		else if (c !== 10 && c !== 11 && c !== 12 && c !== 13) return width;
		if (width >= MAX_INDENT) return MAX_INDENT;
	}
	return -1;
}

/** Adds the score of splitting the file just before line `split` to `score`. */
function addSplit(side: Side, split: number, score: Score): void {
	let endOfFile = split >= side.length;
	let indent = endOfFile ? -1 : indentOf(side, split);
	let preBlank = 0;
	let preIndent = -1;
	for (let i = split - 1; i >= 0; i--) {
		preIndent = indentOf(side, i);
		if (preIndent !== -1) break;
		preBlank++;
		if (preBlank === MAX_BLANKS) {
			preIndent = 0;
			break;
		}
	}
	let postBlankRun = 0;
	let postIndent = -1;
	for (let i = split + 1; i < side.length; i++) {
		postIndent = indentOf(side, i);
		if (postIndent !== -1) break;
		postBlankRun++;
		if (postBlankRun === MAX_BLANKS) {
			postIndent = 0;
			break;
		}
	}
	if (preIndent === -1 && preBlank === 0) score.penalty += WEIGHTS.startOfFile;
	if (endOfFile) score.penalty += WEIGHTS.endOfFile;
	let postBlank = indent === -1 ? 1 + postBlankRun : 0;
	let totalBlank = preBlank + postBlank;
	score.penalty += WEIGHTS.totalBlank * totalBlank + WEIGHTS.postBlank * postBlank;
	let effective = indent === -1 ? postIndent : indent;
	let anyBlanks = totalBlank !== 0;
	score.effectiveIndent += effective;
	if (effective === -1 || preIndent === -1 || effective === preIndent) return;
	if (effective > preIndent) {
		score.penalty += anyBlanks ? WEIGHTS.relativeIndentWithBlank : WEIGHTS.relativeIndent;
	} else if (postIndent !== -1 && postIndent > effective) {
		score.penalty += anyBlanks ? WEIGHTS.relativeOutdentWithBlank : WEIGHTS.relativeOutdent;
	} else {
		score.penalty += anyBlanks ? WEIGHTS.relativeDedentWithBlank : WEIGHTS.relativeDedent;
	}
}

/** Negative when `left` is the better split, comparing indentation before penalties. */
function compareScores(left: Score, right: Score): number {
	let indents = Math.sign(left.effectiveIndent - right.effectiveIndent);
	return WEIGHTS.indent * indents + (left.penalty - right.penalty);
}

/** Moves `g` to the next group of changes, or answers false at the end of the file. */
function nextGroup(changed: Uint8Array, length: number, g: Group): boolean {
	if (g.end === length) return false;
	g.start = g.end + 1;
	g.end = g.start;
	while (changed[g.end + 1]) g.end++;
	return true;
}

/** Moves `g` to the previous group of changes, or answers false at the start of the file. */
function previousGroup(changed: Uint8Array, g: Group): boolean {
	if (g.start === 0) return false;
	g.end = g.start - 1;
	g.start = g.end;
	while (changed[g.start]) g.start--;
	return true;
}

/** Slides `g` one line down when its first line equals the line after it, absorbing neighbours. */
function slideDown(side: Side, changed: Uint8Array, g: Group): boolean {
	if (g.end >= side.length || side.ids[g.start] !== side.ids[g.end]) return false;
	changed[g.start + 1] = 0;
	changed[g.end + 1] = 1;
	g.start++;
	g.end++;
	while (changed[g.end + 1]) g.end++;
	return true;
}

/** Slides `g` one line up when its last line equals the line before it, absorbing neighbours. */
function slideUp(side: Side, changed: Uint8Array, g: Group): boolean {
	if (g.start === 0 || side.ids[g.start - 1] !== side.ids[g.end - 1]) return false;
	g.start--;
	g.end--;
	changed[g.start + 1] = 1;
	changed[g.end + 1] = 0;
	while (changed[g.start]) g.start--;
	return true;
}

/**
 * Picks where between `earliestEnd` and `g.end` a slidable block reads best by indentation,
 * and slides it there, keeping the other file's group cursor in step.
 */
function slideToIndent(
	side: Side,
	changed: Uint8Array,
	g: Group,
	otherChanged: Uint8Array,
	go: Group,
	earliestEnd: number,
): void {
	let size = g.end - g.start;
	let shift = Math.max(earliestEnd, g.end - size - 1, g.end - MAX_SLIDING);
	let bestShift = -1;
	let best: Score = { effectiveIndent: 0, penalty: 0 };
	for (; shift <= g.end; shift++) {
		let score: Score = { effectiveIndent: 0, penalty: 0 };
		addSplit(side, shift, score);
		addSplit(side, shift - size, score);
		if (bestShift === -1 || compareScores(score, best) <= 0) {
			best = score;
			bestShift = shift;
		}
	}
	while (g.end > bestShift) {
		slideUp(side, changed, g);
		previousGroup(otherChanged, go);
	}
}

/**
 * Re-aligns a merged block `[start, end)` against the other file's block
 * `[otherStart, otherEnd)`, rewriting both files' change marks inside those ranges.
 */
export type Rediff = (start: number, end: number, otherStart: number, otherEnd: number) => void;

/**
 * Compacts the changes of `side` against the other file's change marks. Both change arrays
 * are offset by one, with unchanged sentinels at both ends. When sliding merged blocks that
 * face changes on the other side, `rediff` finds the lines the merged pair still shares.
 */
export function compact(
	side: Side,
	changed: Uint8Array,
	otherLength: number,
	otherChanged: Uint8Array,
	rediff?: Rediff,
): void {
	let g: Group = { start: 0, end: 0 };
	let go: Group = { start: 0, end: 0 };
	while (changed[g.end + 1]) g.end++;
	while (otherChanged[go.end + 1]) go.end++;
	for (;;) {
		if (g.end !== g.start) {
			let originalStart = g.start;
			let originalEnd = g.end;
			let earliestEnd: number;
			let endMatchingOther: number;
			let size: number;
			do {
				size = g.end - g.start;
				endMatchingOther = -1;
				while (slideUp(side, changed, g)) previousGroup(otherChanged, go);
				earliestEnd = g.end;
				if (go.end > go.start) endMatchingOther = g.end;
				while (slideDown(side, changed, g)) {
					nextGroup(otherChanged, otherLength, go);
					if (go.end > go.start) endMatchingOther = g.end;
				}
			} while (size !== g.end - g.start);
			if (g.end !== earliestEnd && endMatchingOther !== -1) {
				while (go.end === go.start) {
					slideUp(side, changed, g);
					previousGroup(otherChanged, go);
				}
			} else if (g.end !== earliestEnd) {
				slideToIndent(side, changed, g, otherChanged, go, earliestEnd);
			}
			if (rediff && go.end !== go.start && (g.start !== originalStart || g.end !== originalEnd)) {
				rediff(g.start, g.end, go.start, go.end);
			}
		}
		if (!nextGroup(changed, side.length, g)) break;
		nextGroup(otherChanged, otherLength, go);
	}
}

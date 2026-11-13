/**
 * The arithmetic a diff view draws from: hunk headers as git writes them, deleted and added
 * lines paired for the split view, each side of a hunk highlighted as one run of source,
 * word ranges cut into marked runs, and the five-block bar of a file's change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk, Line, WordRange } from "@sdxc/diff";

import { tokenizeLines } from "@sdxc/highlight";

import type { CodeToken } from "../../utils/code-lines.js";

/** The side a line number counts on: `L` for the old file, `R` for the new one. */
export type DiffSide = "L" | "R";

/** One row of the split view: indices into `hunk.lines` for each side, absent for a filler. */
export interface SplitRow {
	old?: number;
	new?: number;
}

/** A run of source with whether it falls inside a changed word range. */
export interface MarkedRun extends CodeToken {
	marked: boolean;
}

/** One block of a file's change bar. */
export type ChangeBlock = "add" | "del" | "neutral";

/** Blocks a file's change bar draws. */
export const CHANGE_BLOCKS = 5;

/**
 * Highlighted runs per hunk, keyed by language, so a page that draws a hunk twice (a file
 * and its thread excerpt) tokenizes it once. Keyed on the hunk object, the cache lives as
 * long as the parsed patch does.
 */
const HUNK_TOKENS = new WeakMap<Hunk, Map<string, CodeToken[][]>>();

/**
 * Writes a hunk's header line as git does: `@@ -20,7 +20,8 @@ section`, leaving out a count
 * of 1, so the text matches the patch it came from.
 *
 * @param hunk The hunk to name.
 * @returns The header text, section included when the hunk has one.
 * @example hunkHeader({ oldStart: 20, oldLines: 7, newStart: 20, newLines: 8, lines: [] }) // "@@ -20,7 +20,8 @@"
 */
export function hunkHeader(hunk: Hunk): string {
	let side = (start: number, count: number) => (count === 1 ? `${start}` : `${start},${count}`);
	let header = `@@ -${side(hunk.oldStart, hunk.oldLines)} +${side(hunk.newStart, hunk.newLines)} @@`;
	return hunk.section ? `${header} ${hunk.section}` : header;
}

/**
 * Pairs a hunk's lines for the split view: a context line fills both sides, and a run of
 * deletions followed by a run of additions lines up row by row, the shorter run leaving
 * fillers on its side.
 *
 * @param lines The hunk's lines, in patch order.
 * @returns One row per drawn line pair.
 */
export function splitRows(lines: readonly Line[]): SplitRow[] {
	let rows: SplitRow[] = [];
	let index = 0;
	while (index < lines.length) {
		if (lines[index]!.kind === "context") {
			rows.push({ old: index, new: index });
			index += 1;
			continue;
		}
		let dels: number[] = [];
		let adds: number[] = [];
		while (index < lines.length && lines[index]!.kind === "del") dels.push(index++);
		while (index < lines.length && lines[index]!.kind === "add") adds.push(index++);
		for (let pair = 0; pair < Math.max(dels.length, adds.length); pair += 1) {
			rows.push({ old: dels[pair], new: adds[pair] });
		}
	}
	return rows;
}

/**
 * Highlights a hunk as two runs of source, the old side (context and deletions) and the new
 * side (context and additions), each tokenized in one pass, so a string or comment that
 * spans lines inside the hunk paints whole. Context lines take the new side's runs.
 *
 * @param hunk The hunk to highlight.
 * @param language The language its file highlights as; omitted, every line is one plain run.
 * @returns One list of runs per entry of `hunk.lines`.
 */
export function hunkTokens(hunk: Hunk, language: string | undefined): CodeToken[][] {
	if (!language) {
		return hunk.lines.map((line) => (line.text ? [{ type: "plain", value: line.text }] : []));
	}
	let byLanguage = HUNK_TOKENS.get(hunk);
	let cached = byLanguage?.get(language);
	if (cached) return cached;

	let oldIndices: number[] = [];
	let newIndices: number[] = [];
	for (let [index, line] of hunk.lines.entries()) {
		if (line.kind !== "add") oldIndices.push(index);
		if (line.kind !== "del") newIndices.push(index);
	}
	let runs: CodeToken[][] = Array.from({ length: hunk.lines.length }, () => []);
	paintSide(hunk, oldIndices, language, runs, "del");
	paintSide(hunk, newIndices, language, runs, "new");

	if (!byLanguage) {
		byLanguage = new Map();
		HUNK_TOKENS.set(hunk, byLanguage);
	}
	byLanguage.set(language, runs);
	return runs;
}

/**
 * Tokenizes one side's lines as a single source and writes each line's runs back to its
 * slot: the old side's pass keeps only deletions, and the new side's pass keeps context
 * lines and additions.
 */
function paintSide(
	hunk: Hunk,
	indices: number[],
	language: string,
	runs: CodeToken[][],
	keeps: "del" | "new",
): void {
	if (indices.length === 0) return;
	let source = indices.map((index) => hunk.lines[index]!.text).join("\n");
	let lines = tokenizeLines(source, language);
	for (let [position, index] of indices.entries()) {
		let isDel = hunk.lines[index]!.kind === "del";
		if (isDel === (keeps === "del")) runs[index] = lines[position]?.tokens ?? [];
	}
}

/**
 * Cuts a line's runs at the edges of its changed word ranges, so each piece is either all
 * inside a range or all outside it, and neighbouring pieces of one type and marking merge.
 *
 * @param runs The line's highlighted runs, covering its text in order.
 * @param words `[start, end)` offsets of the changed spans; absent or empty marks nothing.
 * @returns The runs, each flagged as marked or not.
 * @example markRuns([{ type: "plain", value: "let b = 3;" }], [[8, 9]]) // "let b = " | "3" (marked) | ";"
 */
export function markRuns(
	runs: readonly CodeToken[],
	words: readonly WordRange[] | undefined,
): MarkedRun[] {
	let pieces: MarkedRun[] = [];
	let push = (type: string, value: string, marked: boolean) => {
		if (value === "") return;
		let last = pieces[pieces.length - 1];
		if (last && last.type === type && last.marked === marked) last.value += value;
		else pieces.push({ type, value, marked });
	};
	let ranges = words ?? [];
	let offset = 0;
	let range = 0;
	for (let run of runs) {
		let start = offset;
		let end = offset + run.value.length;
		let cursor = start;
		while (cursor < end) {
			while (range < ranges.length && ranges[range]![1] <= cursor) range += 1;
			let next = ranges[range];
			if (next === undefined || next[0] >= end) {
				push(run.type, run.value.slice(cursor - start), false);
				cursor = end;
			} else if (next[0] > cursor) {
				push(run.type, run.value.slice(cursor - start, next[0] - start), false);
				cursor = next[0];
			} else {
				let stop = Math.min(end, next[1]);
				push(run.type, run.value.slice(cursor - start, stop - start), true);
				cursor = stop;
			}
		}
		offset = end;
	}
	return pieces;
}

/**
 * The five blocks a file's change bar draws: additions and deletions in proportion to the
 * change, each at least one block when nonzero, and neutral blocks for the rest when the
 * change is smaller than the bar.
 *
 * @param additions Lines added.
 * @param deletions Lines deleted.
 * @returns {@link CHANGE_BLOCKS} blocks, additions first.
 * @example changeBlocks(12, 3) // ["add", "add", "add", "add", "del"]
 */
export function changeBlocks(additions: number, deletions: number): ChangeBlock[] {
	let total = additions + deletions;
	if (total === 0) return Array.from({ length: CHANGE_BLOCKS }, () => "neutral");
	let filled = Math.min(CHANGE_BLOCKS, total);
	let added = Math.round((additions / total) * filled);
	if (additions > 0 && added === 0) added = 1;
	if (deletions > 0 && added === filled) added = filled - 1;
	let blocks: ChangeBlock[] = [];
	for (let index = 0; index < CHANGE_BLOCKS; index += 1) {
		if (index < added) blocks.push("add");
		else if (index < filled) blocks.push("del");
		else blocks.push("neutral");
	}
	return blocks;
}

/** FNV-1a offset basis, the starting state of the hash that names a file from its path. */
const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a prime, which spreads each character through the hash. */
const FNV_PRIME = 0x01000193;

/**
 * A short id derived from a path, so a file's card and line anchors keep the same ids on
 * every render of the same change, and a link to `#diff-<hash>R12` survives a reload.
 *
 * @param path The file's path.
 * @returns A base-36 hash, stable across runs.
 */
export function pathHash(path: string): string {
	let hash = FNV_OFFSET;
	for (let index = 0; index < path.length; index += 1) {
		hash ^= path.charCodeAt(index);
		hash = Math.imul(hash, FNV_PRIME);
	}
	return (hash >>> 0).toString(36);
}

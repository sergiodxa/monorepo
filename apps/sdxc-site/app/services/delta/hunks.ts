/**
 * Reworks parsed hunks the way a code host's review screens need: walking a file back across a
 * patch to read it as it was, widening each hunk's context ("expand context") from the file's
 * own lines, and cutting a short excerpt of a hunk around the lines a thread cites.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Hunk, Line } from "@sdxc/diff";

/** Lines a reader reveals with each press of a hunk's expand link. */
export const EXPAND_STEP = 20;

/** The first line a hunk covers on each side, counted from 1, even for a side it leaves empty. */
function firstLines(hunk: Hunk): { old: number; new: number } {
	return {
		old: hunk.oldLines > 0 ? hunk.oldStart : hunk.oldStart + 1,
		new: hunk.newLines > 0 ? hunk.newStart : hunk.newStart + 1,
	};
}

/**
 * A file's lines as they were before a patch, from its lines after it: every hunk's region is
 * swapped back for its context and deleted lines, and the lines between hunks stay as they are.
 *
 * @param lines The file after the patch, one entry per line.
 * @param hunks That file's hunks in the patch, in order.
 * @returns The file before the patch.
 */
export function unapplyHunks(lines: readonly string[], hunks: readonly Hunk[]): string[] {
	let before: string[] = [];
	let cursor = 0;
	for (let hunk of hunks) {
		let start = hunk.newLines === 0 ? hunk.newStart : hunk.newStart - 1;
		before.push(...lines.slice(cursor, start));
		for (let line of hunk.lines) if (line.kind !== "add") before.push(line.text);
		cursor = start + hunk.newLines;
	}
	before.push(...lines.slice(cursor));
	return before;
}

/** One line of the whole file, and whether the patch shows it. */
interface Placed {
	line: Line;
	shown: boolean;
}

/**
 * Every line of the new file in order, the patch's lines where it has them and the file's
 * own lines, as unchanged context, in the gaps between hunks.
 */
function placeLines(hunks: readonly Hunk[], lines: readonly string[]): Placed[] {
	let placed: Placed[] = [];
	let next = 1;
	let offset = 0;
	let gap = (until: number) => {
		for (; next < until && next <= lines.length; next++) {
			placed.push({
				line: { kind: "context", old: next + offset, new: next, text: lines[next - 1] ?? "" },
				shown: false,
			});
		}
	};
	for (let hunk of hunks) {
		let first = firstLines(hunk);
		offset = first.old - first.new;
		gap(first.new);
		for (let line of hunk.lines) placed.push({ line, shown: true });
		next = first.new + hunk.newLines;
		offset = first.old + hunk.oldLines - next;
	}
	gap(lines.length + 1);
	return placed;
}

/** One run of shown lines as a hunk, its header counted from the lines it holds. */
function toHunk(run: Line[], section: string | undefined): Hunk {
	let olds = run.flatMap((line) => (line.old === undefined ? [] : [line.old]));
	let news = run.flatMap((line) => (line.new === undefined ? [] : [line.new]));
	let oldStart = olds[0] ?? Math.max(0, (run[0]?.new ?? 1) - 1);
	let newStart = news[0] ?? Math.max(0, (run[0]?.old ?? 1) - 1);
	return {
		oldStart,
		oldLines: olds.length,
		newStart,
		newLines: news.length,
		section,
		lines: run,
	};
}

/**
 * The hunks with `extra` more lines of the file's own context around each, merging hunks
 * whose context meets, as a reader's presses of "expand context" leave them.
 *
 * @param hunks The file's hunks as the patch holds them.
 * @param lines The whole file on the new side.
 * @param extra Lines to add before and after every hunk.
 * @returns The widened hunks; the same hunks when `extra` is 0.
 */
export function expandHunks(
	hunks: readonly Hunk[],
	lines: readonly string[],
	extra: number,
): Hunk[] {
	if (extra <= 0 || hunks.length === 0) return [...hunks];
	let placed = placeLines(hunks, lines);
	let near = Array.from({ length: placed.length }, () => false);
	placed.forEach((entry, index) => {
		if (!entry.shown) return;
		let from = Math.max(0, index - extra);
		let to = Math.min(placed.length - 1, index + extra);
		for (let position = from; position <= to; position++) near[position] = true;
	});
	let sections = new Map<Line, string | undefined>(
		hunks.map((hunk) => [hunk.lines[0]!, hunk.section]),
	);
	let result: Hunk[] = [];
	let run: Line[] = [];
	let section: string | undefined;
	let flush = () => {
		if (run.length > 0) result.push(toHunk(run, section));
		run = [];
		section = undefined;
	};
	placed.forEach((entry, index) => {
		if (!near[index]) return flush();
		if (run.length === 0) section = sections.get(entry.line);
		run.push(entry.line);
	});
	flush();
	return result;
}

/** Whether lines of the file lie outside every hunk, so an expand link still has work to do. */
export function hasHiddenLines(hunks: readonly Hunk[], lines: readonly string[]): boolean {
	return placeLines(hunks, lines).some((entry) => !entry.shown);
}

/**
 * The few lines of a hunk ending at the last line a thread cites, as one hunk of their own:
 * the code a thread shows above its comments on the conversation, as GitHub cuts it.
 *
 * @param hunks The file's hunks.
 * @param side `"R"` for a line on the new side, `"L"` for one on the old.
 * @param end The last line the thread cites on that side.
 * @param size How many lines the excerpt holds at most.
 * @returns The excerpt, or `undefined` when no hunk shows that line.
 */
export function excerptHunk(
	hunks: readonly Hunk[],
	side: "L" | "R",
	end: number,
	size = 4,
): Hunk | undefined {
	for (let hunk of hunks) {
		let index = hunk.lines.findIndex((line) =>
			side === "R"
				? line.kind !== "del" && line.new === end
				: line.kind !== "add" && line.old === end,
		);
		if (index === -1) continue;
		return toHunk(hunk.lines.slice(Math.max(0, index - size + 1), index + 1), hunk.section);
	}
	return undefined;
}

/**
 * Finds the first line on the new side of the hunks whose text contains `match`, the way a
 * seeded thread names the code it is about, and the `span` lines from it.
 *
 * @returns The first and last line on the new side, or `undefined` when no shown line matches.
 */
export function findInHunks(
	hunks: readonly Hunk[],
	match: string,
	span = 1,
): { start: number; end: number } | undefined {
	for (let hunk of hunks) {
		for (let line of hunk.lines) {
			if (line.kind === "del" || line.new === undefined || !line.text.includes(match)) continue;
			return { start: line.new, end: line.new + Math.max(1, span) - 1 };
		}
	}
	return undefined;
}

/**
 * Fuzzy matching for file paths: a query matches when its characters appear in order, and a
 * match scores higher where it lands on a path-segment or word start, runs consecutively, or
 * falls in the file's own name. Shared by the palette's finder and a server's `/find` page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Every matched character earns this much before bonuses. */
const SCORE_MATCH = 16;

/** A match on the first character of a path segment (the start, or just after `/`). */
const BONUS_SEGMENT_START = 40;

/** A match on a word start inside a segment: after `-`, `_`, `.` or a space, or a camelCase hump. */
const BONUS_WORD_START = 28;

/** A match right after the previous query character's match. */
const BONUS_CONSECUTIVE = 36;

/** A match inside the last segment, the file's own name. */
const BONUS_BASENAME = 10;

/** What each skipped path character between two matches costs. */
const PENALTY_GAP = 1;

/** Stands for "no way to match here"; far below any reachable score. */
const UNREACHABLE = -1e9;

/** How many results {@link fuzzyFilter} returns when `limit` is omitted. */
const DEFAULT_LIMIT = 50;

/** One path a query matched, with where. */
export interface FuzzyMatch {
	path: string;
	/** Higher is better; only comparable between results of the same query. */
	score: number;
	/** The UTF-16 offsets of the matched characters, ascending, for bolding them. */
	positions: number[];
	/** The path's index in the list it came from. */
	index: number;
}

/** One stretch of a path, and whether the query matched it; the shape `Highlight` reads. */
export interface FuzzySegment {
	text: string;
	match: boolean;
}

/** Reused score and back-pointer tables, grown to the largest query × path seen. */
const TABLES = { scores: new Float64Array(0), from: new Int32Array(0) };

/** Lower-cases a query and drops its whitespace, since paths are matched character by character. */
function foldQuery(query: string): string {
	return query.toLowerCase().replace(/\s+/g, "");
}

/** Lower-cases a path keeping every offset, so positions found in it index the original. */
function foldPath(path: string): string {
	let folded = path.toLowerCase();
	if (folded.length === path.length) return folded;
	let out = "";
	for (let char of path) {
		let lower = char.toLowerCase();
		out += lower.length === char.length ? lower : char;
	}
	return out;
}

/** Whether every character of `query` appears in `text` in order. */
function isSubsequence(query: string, text: string): boolean {
	let at = 0;
	for (let index = 0; index < query.length; index++) {
		at = text.indexOf(query[index]!, at);
		if (at === -1) return false;
		at++;
	}
	return true;
}

/** The bonus a match at `index` earns for where it lands in the path. */
function positionBonus(path: string, index: number, basenameStart: number): number {
	let bonus = index >= basenameStart ? BONUS_BASENAME : 0;
	if (index === 0) return bonus + BONUS_SEGMENT_START;
	let previous = path[index - 1]!;
	if (previous === "/") return bonus + BONUS_SEGMENT_START;
	if (previous === "-" || previous === "_" || previous === "." || previous === " ") {
		return bonus + BONUS_WORD_START;
	}
	let char = path[index]!;
	let isUpper = char !== char.toLowerCase();
	let previousIsLower = previous !== previous.toUpperCase();
	return isUpper && previousIsLower ? bonus + BONUS_WORD_START : bonus;
}

/** Scores a folded query against one path whose folded form is `folded`, or `null` when it misses. */
function scoreFolded(
	query: string,
	path: string,
	folded: string,
): { score: number; positions: number[] } | null {
	let rows = query.length;
	if (rows === 0) return { score: 0, positions: [] };
	if (!isSubsequence(query, folded)) return null;
	let cols = folded.length;
	let size = rows * cols;
	if (TABLES.scores.length < size) {
		TABLES.scores = new Float64Array(size * 2);
		TABLES.from = new Int32Array(size * 2);
	}
	let { scores, from } = TABLES;
	let basenameStart = path.lastIndexOf("/") + 1;

	for (let row = 0; row < rows; row++) {
		let char = query[row];
		let base = row * cols;
		let above = base - cols;
		/** The best score of the previous row up to `col - 1`, less the gap from there to here. */
		let carried = UNREACHABLE;
		let carriedFrom = -1;
		for (let col = 0; col < cols; col++) {
			if (row > 0 && col > 0) {
				carried -= PENALTY_GAP;
				let previous = scores[above + col - 1]!;
				if (previous >= carried) {
					carried = previous;
					carriedFrom = col - 1;
				}
			}
			if (folded[col] !== char) {
				scores[base + col] = UNREACHABLE;
				continue;
			}
			let earned = SCORE_MATCH + positionBonus(path, col, basenameStart);
			if (row === 0) {
				scores[base + col] = earned;
				from[base + col] = -1;
				continue;
			}
			let best = carried;
			let bestFrom = carriedFrom;
			if (col > 0) {
				let consecutive = scores[above + col - 1]! + BONUS_CONSECUTIVE;
				if (consecutive >= best) {
					best = consecutive;
					bestFrom = col - 1;
				}
			}
			scores[base + col] = best <= UNREACHABLE / 2 ? UNREACHABLE : best + earned;
			from[base + col] = bestFrom;
		}
	}

	let last = (rows - 1) * cols;
	let end = -1;
	let score = UNREACHABLE;
	for (let col = 0; col < cols; col++) {
		if (scores[last + col]! > score) {
			score = scores[last + col]!;
			end = col;
		}
	}
	if (end === -1 || score <= UNREACHABLE / 2) return null;

	let positions = Array.from<number>({ length: rows });
	let col = end;
	for (let row = rows - 1; row >= 0; row--) {
		positions[row] = col;
		col = from[row * cols + col]!;
	}
	return { score, positions };
}

/**
 * Scores `query` against one path. Case is ignored and whitespace in the query is dropped; an
 * empty query matches every path with a score of 0.
 *
 * @param query What was typed.
 * @param path The path to score.
 * @returns The score and matched offsets, or `null` when the characters do not appear in order.
 * @example fuzzyScore("plv", "packages/log-viewer.tsx") // { score: …, positions: [0, 9, 13] }
 */
export function fuzzyScore(
	query: string,
	path: string,
): { score: number; positions: number[] } | null {
	return scoreFolded(foldQuery(query), path, foldPath(path));
}

/**
 * Ranks the paths `query` matches, best first; ties go to the shorter path, then to the
 * earlier one. An empty query keeps the list's own order. Linear in the paths and quadratic
 * only in one path's length times the query's, so 5,000 paths rank within a keystroke.
 *
 * @param query What was typed.
 * @param paths Every path to search.
 * @param limit How many results to keep. @default 50
 * @returns The best `limit` matches with their offsets.
 * @example fuzzyFilter(url.searchParams.get("q") ?? "", tree.paths, 100)
 */
export function fuzzyFilter(
	query: string,
	paths: readonly string[],
	limit: number = DEFAULT_LIMIT,
): FuzzyMatch[] {
	let folded = foldQuery(query);
	if (folded === "") {
		return paths.slice(0, limit).map((path, index) => ({ path, score: 0, positions: [], index }));
	}
	let matches: FuzzyMatch[] = [];
	for (let index = 0; index < paths.length; index++) {
		let path = paths[index]!;
		let match = scoreFolded(folded, path, foldPath(path));
		if (match !== null)
			matches.push({ path, score: match.score, positions: match.positions, index });
	}
	matches.sort((a, b) => b.score - a.score || a.path.length - b.path.length || a.index - b.index);
	return matches.slice(0, limit);
}

/**
 * Splits a path into stretches at the matched offsets, merging neighbours, so a renderer can
 * bold each matched run with one element.
 *
 * @param path The matched path.
 * @param positions The offsets a {@link FuzzyMatch} reports.
 * @returns The path's stretches in order.
 * @example fuzzySegments("src/app.ts", [4, 5]) // [{ text: "src/", match: false }, { text: "ap", match: true }, …]
 */
export function fuzzySegments(path: string, positions: readonly number[]): FuzzySegment[] {
	let marked = new Set(positions);
	let segments: FuzzySegment[] = [];
	for (let index = 0; index < path.length; index++) {
		let match = marked.has(index);
		let last = segments.at(-1);
		if (last !== undefined && last.match === match) last.text += path[index];
		else segments.push({ text: path[index]!, match });
	}
	return segments;
}

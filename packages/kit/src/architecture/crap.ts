/**
 * CRAP (Change Risk Anti-Patterns) scores: cyclomatic complexity squared times uncovered cubed,
 * plus complexity — the metric Uncle Bob uses with agents so an untested complex function
 * outranks a covered one. Coverage comes from Istanbul's `coverage-final.json` when present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import type { FunctionComplexity } from "./complexity.js";

/** One function's CRAP score with the inputs that produced it. */
export interface CrapScore {
	file: string;
	name: string;
	line: number;
	complexity: number;
	/** Coverage fraction in `[0, 1]`; `null` when no coverage data matched the function. */
	coverage: number | null;
	/** The CRAP value, or `null` when coverage is unknown. */
	crap: number | null;
}

/** Istanbul's per-file entry in `coverage-final.json`. */
interface IstanbulFile {
	path?: string;
	fnMap?: Record<string, { name?: string; decl?: { start?: { line?: number } } }>;
	f?: Record<string, number>;
	s?: Record<string, number>;
	statementMap?: Record<string, { start?: { line?: number }; end?: { line?: number } }>;
}

/**
 * CRAP = CC² × (1 − coverage)³ + CC. Coverage is a fraction; a fully covered function of
 * complexity `cc` scores exactly `cc`.
 */
export function crapScore(complexity: number, coverage: number): number {
	let uncovered = 1 - clamp(coverage, 0, 1);
	return complexity * complexity * uncovered * uncovered * uncovered + complexity;
}

/**
 * Scores each function, attaching coverage from `coverageByFile` when a hit map names it.
 * Without a match the score stays `null` so the doctor check can skip or warn on unknowns.
 */
export function scoreFunctions(
	file: string,
	functions: readonly FunctionComplexity[],
	coverageByFile: ReadonlyMap<string, IstanbulFile>,
): CrapScore[] {
	let entry = coverageByFile.get(normalizePath(file));
	return functions.map((fn) => {
		let coverage = entry ? functionCoverage(entry, fn) : null;
		return {
			file,
			name: fn.name,
			line: fn.line,
			complexity: fn.complexity,
			coverage,
			crap: coverage === null ? null : crapScore(fn.complexity, coverage),
		};
	});
}

/**
 * Loads Istanbul's `coverage-final.json` at `path` (absolute or relative to `root`) into a map
 * keyed by project-relative paths. A missing or unreadable file yields an empty map.
 */
export async function loadCoverage(root: string, path: string): Promise<Map<string, IstanbulFile>> {
	let absolute = resolve(root, path);
	let text = await wrap(() => readFile(absolute, "utf8"));
	if (isFailure(text)) return new Map();
	let parsed = await wrap(() =>
		Promise.resolve(JSON.parse(text.data) as Record<string, IstanbulFile>),
	);
	if (isFailure(parsed) || typeof parsed.data !== "object" || parsed.data === null) {
		return new Map();
	}
	let map = new Map<string, IstanbulFile>();
	for (let [key, value] of Object.entries(parsed.data)) {
		let relative = toProjectPath(root, value.path ?? key);
		map.set(normalizePath(relative), value);
	}
	return map;
}

/** Whether `path` exists as a readable coverage file under `root`. */
export async function coverageExists(root: string, path: string): Promise<boolean> {
	let absolute = resolve(root, path);
	let text = await wrap(() => readFile(absolute, "utf8"));
	return !isFailure(text);
}

/**
 * Coverage fraction for `fn` from Istanbul's function hit map, falling back to statement
 * coverage on the function's starting line when the name is missing from `fnMap`.
 */
function functionCoverage(entry: IstanbulFile, fn: FunctionComplexity): number | null {
	if (entry.fnMap && entry.f) {
		for (let [id, meta] of Object.entries(entry.fnMap)) {
			let name = meta.name ?? "";
			let line = meta.decl?.start?.line;
			let nameMatch =
				name === fn.name ||
				name.endsWith(`.${fn.name}`) ||
				(fn.name !== "(anonymous)" && name === fn.name.split(".").pop());
			let lineMatch = line === undefined || line === fn.line;
			if (nameMatch && lineMatch) {
				let hits = entry.f[id] ?? 0;
				return hits > 0 ? 1 : 0;
			}
		}
	}
	if (entry.statementMap && entry.s) {
		let total = 0;
		let covered = 0;
		for (let [id, span] of Object.entries(entry.statementMap)) {
			let start = span.start?.line ?? 0;
			let end = span.end?.line ?? start;
			if (fn.line < start || fn.line > end) continue;
			total += 1;
			if ((entry.s[id] ?? 0) > 0) covered += 1;
		}
		if (total > 0) return covered / total;
	}
	return null;
}

function toProjectPath(root: string, filePath: string): string {
	let absolute = resolve(filePath);
	let rootAbsolute = resolve(root);
	if (absolute.startsWith(rootAbsolute)) {
		return absolute
			.slice(rootAbsolute.length)
			.replace(/^[\\/]/, "")
			.split("\\")
			.join("/");
	}
	return filePath.split("\\").join("/");
}

function normalizePath(path: string): string {
	return path.split("\\").join("/");
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** Joins `root` and a relative coverage path for error messages. */
export function coveragePath(root: string, relative: string): string {
	return join(root, relative);
}

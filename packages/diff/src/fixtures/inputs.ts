/**
 * Deterministic inputs shared by the benchmarks and the cost tests: source-like files with a
 * few edits, a rewrite, a moved block, a minified line and a large multi-file patch. A seeded
 * generator keeps every run measuring the same text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { PatchEntry } from "../types.js";

import { diffLines } from "../diff-lines.js";
import { stringifyPatch } from "../stringify.js";

/** Identifiers the generated code is built from. */
const WORDS = ["value", "result", "items", "index", "count", "next", "error", "options", "path"];

/** A small linear congruential generator, so the same seed always yields the same text. */
export function random(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 2 ** 32;
	};
}

/** Picks one identifier with `next`. */
function word(next: () => number): string {
	return WORDS[Math.floor(next() * WORDS.length)]!;
}

/**
 * Builds `count` lines shaped like TypeScript: functions with bodies, closing braces and blank
 * lines, so common lines repeat the way they do in real code.
 */
export function sourceLines(count: number, seed: number): string[] {
	let next = random(seed);
	let lines: string[] = [];
	let n = 0;
	while (lines.length < count) {
		lines.push(`export function ${word(next)}${n++}(${word(next)}: number): number {`);
		let body = 2 + Math.floor(next() * 6);
		for (let i = 0; i < body; i++) {
			lines.push(`\tlet ${word(next)} = ${word(next)} + ${Math.floor(next() * 1000)};`);
		}
		lines.push(`\treturn ${word(next)};`, "}", "");
	}
	return lines.slice(0, count);
}

/** Joins lines into a file with a trailing newline. */
export function file(lines: string[]): string {
	return `${lines.join("\n")}\n`;
}

/** Changes one line in every `every` lines, as a typical edit to a long file does. */
export function edited(lines: string[], every: number): string[] {
	return lines.map((line, i) => (i % every === every - 1 ? `${line} // changed` : line));
}

/** Moves `size` lines from the top of the file to the bottom. */
export function moved(lines: string[], size: number): string[] {
	return [...lines.slice(size), ...lines.slice(0, size)];
}

/** One line of minified JavaScript, `length` characters long. */
export function minified(length: number, seed: number): string {
	let next = random(seed);
	let out = "";
	while (out.length < length) {
		out += `function ${word(next)}(a,b){return a+b*${Math.floor(next() * 100)}};`;
	}
	return out.slice(0, length);
}

/** A git-style patch of `files` modified files, each a few hundred lines with scattered edits. */
export function multiFilePatch(files: number, seed: number): string {
	let entries: PatchEntry[] = [];
	for (let f = 0; f < files; f++) {
		let lines = sourceLines(300, seed + f);
		let { hunks } = diffLines(file(lines), file(edited(lines, 9)), { words: false });
		entries.push({
			oldPath: `src/module-${f}.ts`,
			newPath: `src/module-${f}.ts`,
			status: "modified",
			binary: false,
			oldMode: "100644",
			newMode: "100644",
			oldHash: "1234567",
			newHash: "89abcde",
			hunks,
		});
	}
	return stringifyPatch(entries);
}

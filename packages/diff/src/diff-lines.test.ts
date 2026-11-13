/**
 * Tests the line diff: hunk shape and numbering, newline handling, context merging, agreement
 * with `git diff --histogram` on real file histories, Myers minimality, and the cost cap that
 * turns pathological input into an approximate replace block instead of a hang.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { random } from "./fixtures/inputs.js";

import type { Hunk, Line } from "./index.js";

import { diffLines, parseHunks, parsePatch } from "./index.js";

/** Reads a fixture next to this file. */
function fixture(path: string): string {
	return readFileSync(new URL(`./fixtures/${path}`, import.meta.url), "utf8");
}

/** Rebuilds the new text by applying hunks to the old one, proving the hunks are a valid edit. */
function apply(oldText: string, hunks: Hunk[]): string {
	let old = oldText === "" ? [] : oldText.replace(/\n$/, "").split("\n");
	let out: string[] = [];
	let newline = true;
	let next = 0;
	let copy = (end: number) => {
		if (end <= next) return;
		out.push(...old.slice(next, end));
		newline = end < old.length || oldText.endsWith("\n");
		next = end;
	};
	for (let hunk of hunks) {
		copy(hunk.oldLines === 0 ? hunk.oldStart : hunk.oldStart - 1);
		for (let line of hunk.lines) {
			if (line.kind !== "add") next++;
			if (line.kind !== "del") {
				out.push(line.text);
				newline = !line.noNewline;
			}
		}
	}
	copy(old.length);
	return out.length === 0 ? "" : out.join("\n") + (newline ? "\n" : "");
}

/** A compact rendering of hunk lines: a sign per kind, then the text. */
function signs(lines: Line[]): string[] {
	return lines.map((line) => ({ add: "+", del: "-", context: " " })[line.kind] + line.text);
}

/** The length of the longest common subsequence of two arrays, by dynamic programming. */
function lcs(a: string[], b: string[]): number {
	let row = Array.from({ length: b.length + 1 }, () => 0);
	for (let i = 1; i <= a.length; i++) {
		let diagonal = 0;
		for (let j = 1; j <= b.length; j++) {
			let above = row[j]!;
			row[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : Math.max(row[j]!, row[j - 1]!);
			diagonal = above;
		}
	}
	return row[b.length]!;
}

describe("diffLines", () => {
	test("returns no hunks for equal texts", () => {
		expect(diffLines("a\nb\n", "a\nb\n")).toEqual({
			hunks: [],
			additions: 0,
			deletions: 0,
			approximate: false,
		});
	});

	test("numbers context, deleted and added lines on their own sides", () => {
		let { hunks, additions, deletions } = diffLines("a\nb\nc\n", "a\nB\nc\n", { words: false });

		expect(additions).toBe(1);
		expect(deletions).toBe(1);
		expect(hunks).toEqual([
			{
				oldStart: 1,
				oldLines: 3,
				newStart: 1,
				newLines: 3,
				lines: [
					{ kind: "context", text: "a", old: 1, new: 1 },
					{ kind: "del", text: "b", old: 2 },
					{ kind: "add", text: "B", new: 2 },
					{ kind: "context", text: "c", old: 3, new: 3 },
				],
			},
		]);
	});

	test("starts an insertion into an empty file at line zero, as git does", () => {
		let { hunks } = diffLines("", "x\ny\n");

		expect(hunks).toEqual([
			{
				oldStart: 0,
				oldLines: 0,
				newStart: 1,
				newLines: 2,
				lines: [
					{ kind: "add", text: "x", new: 1 },
					{ kind: "add", text: "y", new: 2 },
				],
			},
		]);
	});

	test("treats a last line without a newline as different from the same line with one", () => {
		let { hunks } = diffLines("a\nb", "a\nb\n", { words: false });

		expect(hunks[0]?.lines).toEqual([
			{ kind: "context", text: "a", old: 1, new: 1 },
			{ kind: "del", text: "b", old: 2, noNewline: true },
			{ kind: "add", text: "b", new: 2 },
		]);
	});

	test("keeps a carriage return as part of the line", () => {
		let { hunks } = diffLines("a\r\nb\r\n", "a\r\nc\r\n", { words: false });

		expect(signs(hunks[0]!.lines)).toEqual([" a\r", "-b\r", "+c\r"]);
	});

	test("shares a hunk between changes at most twice the context apart", () => {
		let old = Array.from({ length: 20 }, (_, i) => `line ${i}`);
		let near = old.map((line, i) => (i === 3 || i === 9 ? `${line}!` : line));
		let far = old.map((line, i) => (i === 3 || i === 11 ? `${line}!` : line));

		expect(diffLines(`${old.join("\n")}\n`, `${near.join("\n")}\n`).hunks).toHaveLength(1);
		expect(diffLines(`${old.join("\n")}\n`, `${far.join("\n")}\n`).hunks).toHaveLength(2);
		expect(
			diffLines(`${old.join("\n")}\n`, `${far.join("\n")}\n`, { context: 0 }).hunks[0],
		).toMatchObject({
			oldStart: 4,
			oldLines: 1,
			newStart: 4,
			newLines: 1,
		});
	});

	test("anchors on rare lines instead of braces, unlike a minimal diff", () => {
		let old = "function a() {\n\treturn 1;\n}\n\nfunction b() {\n\treturn 2;\n}\n";
		let next = "function b() {\n\treturn 2;\n}\n\nfunction a() {\n\treturn 1;\n}\n";
		let { hunks } = diffLines(old, next, { words: false });

		expect(signs(hunks[0]!.lines).slice(0, 4)).toEqual([
			"-function a() {",
			"-\treturn 1;",
			"-}",
			"-",
		]);
	});
});

describe("diffLines matches git diff --histogram", () => {
	for (let name of ["keys", "styles-test", "purity-test", "merged-blocks", "no-newline"]) {
		test(name, () => {
			let patch = fixture(`git/${name}/histogram.patch`);
			let [file] = parsePatch(patch);
			let expected = parseHunks(patch, file!, { words: false });
			let actual = diffLines(fixture(`git/${name}/old.txt`), fixture(`git/${name}/new.txt`), {
				words: false,
			});

			expect(actual.hunks).toEqual(expected);
		});
	}
});

describe("every algorithm produces a valid edit", () => {
	test("hunks rebuild the new text from the old on random inputs", () => {
		let next = random(42);
		for (let round = 0; round < 200; round++) {
			let make = () =>
				Array.from({ length: Math.floor(next() * 30) }, () => "abcde"[Math.floor(next() * 5)]).join(
					"\n",
				) + (next() < 0.5 ? "\n" : "");
			let before = make();
			let after = make();
			for (let algorithm of ["histogram", "myers"] as const) {
				let { hunks } = diffLines(before, after, { algorithm, context: Math.floor(next() * 4) });
				expect(apply(before, hunks), `${algorithm}: ${JSON.stringify([before, after])}`).toBe(
					after,
				);
			}
		}
	});

	test("myers changes as few lines as the longest common subsequence allows", () => {
		let next = random(7);
		for (let round = 0; round < 200; round++) {
			let a = Array.from(
				{ length: Math.floor(next() * 25) },
				() => "xyzw"[Math.floor(next() * 4)]!,
			);
			let b = Array.from(
				{ length: Math.floor(next() * 25) },
				() => "xyzw"[Math.floor(next() * 4)]!,
			);
			let text = (lines: string[]) => lines.map((line) => `${line}\n`).join("");
			let { additions, deletions } = diffLines(text(a), text(b), {
				algorithm: "myers",
			});
			let common = lcs(a, b);

			expect(deletions).toBe(a.length - common);
			expect(additions).toBe(b.length - common);
		}
	});
});

describe("the cost cap", () => {
	/** Two long files built from three distinct lines, the worst case for every aligner. */
	function pathological(length: number, seed: number): string {
		let next = random(seed);
		return `${Array.from({ length }, () => ["{", "}", ""][Math.floor(next() * 3)]).join("\n")}\n`;
	}

	test("gives up on a costly region with one replace block and marks the result approximate", () => {
		let before = pathological(2_000, 1);
		let after = pathological(2_000, 2);
		let capped = diffLines(before, after, { maxCost: 10_000 });

		expect(capped.approximate).toBe(true);
		expect(apply(before, capped.hunks)).toBe(after);
		expect(diffLines(before, after).approximate).toBe(false);
	});

	test("bounds the default work on large pathological input", () => {
		let before = pathological(40_000, 3);
		let after = pathological(40_000, 4);
		let started = performance.now();
		let result = diffLines(before, after, { words: false });

		expect(result.approximate).toBe(true);
		expect(apply(before, result.hunks)).toBe(after);
		expect(performance.now() - started).toBeLessThan(10_000);
	});
});

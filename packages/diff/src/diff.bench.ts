/**
 * Benchmarks `@sdxc/diff` against the `diff` package on the same inputs: a long file with a few
 * edits, a full rewrite, a moved block, a minified line and a 1 MB multi-file patch, with word
 * ranges off so both sides do the same work. Run with `vp test bench packages/diff`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as reference from "diff";
import { bench, describe } from "vitest";

import { edited, file, minified, moved, multiFilePatch, sourceLines } from "./fixtures/inputs.js";

import { diffLines, parseHunks, parsePatch } from "./index.js";

/** The 10,000-line file every line-diff case starts from. */
const LONG = sourceLines(10_000, 1);

/** Each case's two sides, as text. */
const CASES = {
	"10,000 lines, a few edits": [
		file(LONG),
		file(LONG.map((l, i) => (i % 2000 === 7 ? `${l}!` : l))),
	],
	"3,000 lines, full rewrite": [file(sourceLines(3_000, 2)), file(sourceLines(3_000, 3))],
	"10,000 lines, 500-line block moved": [file(LONG), file(moved(LONG, 500))],
	"10,000 lines, every 50th line edited": [file(LONG), file(edited(LONG, 50))],
	"200 kB minified line": [minified(200_000, 4), minified(200_000, 5)],
} as const;

/** About 1 MB of patch across 150 files. */
const PATCH = multiFilePatch(150, 6);

for (let [name, [before, after]] of Object.entries(CASES)) {
	describe(name, () => {
		bench("@sdxc/diff diffLines", () => {
			diffLines(before, after, { words: false });
		});
		bench("diff structuredPatch", () => {
			reference.structuredPatch("a", "b", before, after, "", "", { context: 3 });
		});
	});
}

describe(`${Math.round(PATCH.length / 1024)} kB multi-file patch`, () => {
	bench("@sdxc/diff parsePatch + parseHunks", () => {
		for (let entry of parsePatch(PATCH)) parseHunks(PATCH, entry, { words: false });
	});
	bench("@sdxc/diff parsePatch (headers only)", () => {
		parsePatch(PATCH);
	});
	bench("diff parsePatch", () => {
		reference.parsePatch(PATCH);
	});
});

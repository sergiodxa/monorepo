/**
 * Checks the path matcher: characters must appear in order, segment and word starts outrank
 * matches mid-word, consecutive runs and the file's own name win ties, the offsets bold the
 * right characters, and 5,000 paths rank well within a keystroke.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fuzzyFilter, fuzzyScore, fuzzySegments } from "./fuzzy-path.js";

/** A synthetic repository of `count` paths, deep and repetitive like a real monorepo. */
function repository(count: number): string[] {
	let roots = ["apps", "packages", "docs", "scripts", "test"];
	let names = ["log-viewer", "command-palette", "page-header", "timeline", "diffStat", "index"];
	let exts = [".ts", ".tsx", ".md", ".test.ts", ".browser.test.tsx"];
	let paths: string[] = [];
	for (let index = 0; index < count; index++) {
		let root = roots[index % roots.length]!;
		let name = names[(index >> 2) % names.length]!;
		let ext = exts[(index >> 4) % exts.length]!;
		paths.push(`${root}/workspace-${index % 97}/src/module-${index % 13}/${name}-${index}${ext}`);
	}
	return paths;
}

describe("fuzzyScore", () => {
	test("matches only when every character appears in order, ignoring case", () => {
		expect(fuzzyScore("plv", "packages/Log-Viewer.tsx")).not.toBeNull();
		expect(fuzzyScore("vlp", "packages/log-viewer.tsx")).toBeNull();
		expect(fuzzyScore("xyz", "packages/log-viewer.tsx")).toBeNull();
	});

	test("matches every path with no positions when the query is empty or blank", () => {
		expect(fuzzyScore("", "a/b.ts")).toEqual({ score: 0, positions: [] });
		expect(fuzzyScore("  ", "a/b.ts")).toEqual({ score: 0, positions: [] });
	});

	test("puts matches on segment and word starts over earlier mid-word ones", () => {
		expect(fuzzyScore("lv", "src/log-viewer.ts")!.positions).toEqual([4, 8]);
		expect(fuzzyScore("cp", "src/app/commandPalette.ts")!.positions).toEqual([8, 15]);
	});

	test("ignores whitespace in the query", () => {
		expect(fuzzyScore("log view", "src/log-viewer.ts")!.positions).toEqual([4, 5, 6, 8, 9, 10, 11]);
	});
});

describe("fuzzyFilter", () => {
	test("ranks a word-start match above a scattered one", () => {
		let ranked = fuzzyFilter("pl", ["src/apple.ts", "src/page-layout.ts"]);
		expect(ranked.map((match) => match.path)).toEqual(["src/page-layout.ts", "src/apple.ts"]);
	});

	test("prefers a match in the file's own name to the same match in a folder", () => {
		let ranked = fuzzyFilter("diff", ["diff/src/index.ts", "src/app/diff.ts"]);
		expect(ranked[0]!.path).toBe("src/app/diff.ts");
	});

	test("ranks a consecutive run above the same letters spread out", () => {
		let ranked = fuzzyFilter("lex", ["src/l-e-x.ts", "src/lib/explain.ts", "src/lexer.ts"]);
		expect(ranked[0]!.path).toBe("src/lexer.ts");
	});

	test("breaks ties by the shorter path, then by list order", () => {
		let ranked = fuzzyFilter("a", ["x/a.ts", "a.ts", "y/a.ts"]);
		expect(ranked.map((match) => match.path)).toEqual(["a.ts", "x/a.ts", "y/a.ts"]);
	});

	test("keeps the list's own order and the limit when nothing is typed", () => {
		let ranked = fuzzyFilter("", ["b", "a", "c"], 2);
		expect(ranked.map((match) => [match.path, match.index])).toEqual([
			["b", 0],
			["a", 1],
		]);
	});

	test("ranks 5,000 paths within a keystroke", () => {
		let paths = repository(5_000);
		let queries = ["l", "lv", "logview", "pkgsrcpalette", "apps/ws1/idx", "timelinebrowser"];
		fuzzyFilter("warm", paths);
		let started = performance.now();
		for (let query of queries) {
			let ranked = fuzzyFilter(query, paths);
			expect(ranked.length).toBeGreaterThan(0);
			expect(ranked.length).toBeLessThanOrEqual(50);
		}
		let perQuery = (performance.now() - started) / queries.length;
		expect(perQuery).toBeLessThan(50);
	});
});

describe("fuzzySegments", () => {
	test("splits a path at the matched offsets, merging neighbours", () => {
		expect(fuzzySegments("src/app.ts", [4, 5, 8])).toEqual([
			{ text: "src/", match: false },
			{ text: "ap", match: true },
			{ text: "p.", match: false },
			{ text: "t", match: true },
			{ text: "s", match: false },
		]);
	});
});

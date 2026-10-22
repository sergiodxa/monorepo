/**
 * CRAP formula and scoring against Istanbul hit maps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { crapScore, scoreFunctions } from "./crap.js";

describe("crapScore", () => {
	test("equals complexity when fully covered", () => {
		expect(crapScore(4, 1)).toBe(4);
	});

	test("grows when uncovered", () => {
		expect(crapScore(4, 0)).toBe(20);
		expect(crapScore(5, 0)).toBe(30);
	});
});

describe("scoreFunctions", () => {
	test("attaches coverage from fnMap hits", () => {
		let coverage = new Map([
			[
				"app/models/post.ts",
				{
					fnMap: { "0": { name: "load", decl: { start: { line: 1 } } } },
					f: { "0": 0 },
				},
			],
		]);
		let scores = scoreFunctions(
			"app/models/post.ts",
			[{ name: "load", line: 1, complexity: 4 }],
			coverage,
		);
		expect(scores[0]).toMatchObject({ coverage: 0, crap: 20 });
	});
});

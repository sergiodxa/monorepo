/**
 * Unit tests for `transparency-reduce.ts`, sugar over
 * `media("(prefers-reduced-transparency: reduce)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { serialize } from "../internal/serialize";
import { hover } from "../state/hover";

import { media } from "./media";
import { transparencyReduce } from "./transparency-reduce";

describe("transparencyReduce", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-transparency: reduce)'", async () => {
		expect(await serialize(transparencyReduce(bg()))).toMatch(
			/@media \(prefers-reduced-transparency: reduce\) \{[\s\S]*background-color: var\(--ui-bg, Canvas\)/,
		);
	});

	test("produces the identical stylesheet media('(prefers-reduced-transparency: reduce)', input) would", async () => {
		expect(await serialize(transparencyReduce(bg()))).toBe(
			await serialize(media("(prefers-reduced-transparency: reduce)", bg())),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(transparencyReduce(hover(bg("brand.tint"))))).toMatch(
			/@media \(prefers-reduced-transparency: reduce\) \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});

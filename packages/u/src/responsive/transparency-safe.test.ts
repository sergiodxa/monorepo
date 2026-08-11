/**
 * Unit tests for `transparency-safe.ts`, sugar over
 * `media("(prefers-reduced-transparency: no-preference)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { serialize } from "../internal/serialize";
import { hover } from "../state/hover";

import { media } from "./media";
import { transparencySafe } from "./transparency-safe";

describe("transparencySafe", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-transparency: no-preference)'", async () => {
		expect(await serialize(transparencySafe(bg("neutral.solid")))).toMatch(
			/@media \(prefers-reduced-transparency: no-preference\) \{[\s\S]*background-color: var\(--ui-neutral-bg-solid\)/,
		);
	});

	test("produces the identical stylesheet media('(prefers-reduced-transparency: no-preference)', input) would", async () => {
		expect(await serialize(transparencySafe(bg("neutral.solid")))).toBe(
			await serialize(media("(prefers-reduced-transparency: no-preference)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(transparencySafe(hover(bg("brand.tint"))))).toMatch(
			/@media \(prefers-reduced-transparency: no-preference\) \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});

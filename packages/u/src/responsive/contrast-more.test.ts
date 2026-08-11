/**
 * Unit tests for `contrast-more.ts`, sugar over
 * `media("(prefers-contrast: more)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { fg } from "../color/fg";
import { serialize } from "../internal/serialize";
import { hover } from "../state/hover";

import { contrastMore } from "./contrast-more";
import { media } from "./media";

describe("contrastMore", () => {
	test("nests the wrapped utility's styles under '@media (prefers-contrast: more)'", async () => {
		expect(await serialize(contrastMore(fg("neutral.emphasis")))).toMatch(
			/@media \(prefers-contrast: more\) \{[\s\S]*color: var\(--ui-neutral-fg-emphasis\)/,
		);
	});

	test("produces the identical stylesheet media('(prefers-contrast: more)', input) would", async () => {
		expect(await serialize(contrastMore(fg("neutral.emphasis")))).toBe(
			await serialize(media("(prefers-contrast: more)", fg("neutral.emphasis"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(contrastMore(hover(bg("brand.tint"))))).toMatch(
			/@media \(prefers-contrast: more\) \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});

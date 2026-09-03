/**
 * Unit tests for `forced-colors.ts`, sugar over
 * `media("(forced-colors: active)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { forcedColorAdjust } from "../a11y/forced-color-adjust.js";
import { bg } from "../color/bg.js";
import { serialize } from "../internal/serialize.js";
import { hover } from "../state/hover.js";

import { forcedColors } from "./forced-colors.js";
import { media } from "./media.js";

describe("forcedColors", () => {
	test("nests the wrapped utility's styles under '@media (forced-colors: active)'", async () => {
		expect(await serialize(forcedColors(forcedColorAdjust("none")))).toMatch(
			/@media \(forced-colors: active\) \{[\s\S]*forced-color-adjust: none/,
		);
	});

	test("produces the identical stylesheet media('(forced-colors: active)', input) would", async () => {
		expect(await serialize(forcedColors(bg("neutral.solid")))).toBe(
			await serialize(media("(forced-colors: active)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(forcedColors(hover(bg("brand.tint"))))).toMatch(
			/@media \(forced-colors: active\) \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});

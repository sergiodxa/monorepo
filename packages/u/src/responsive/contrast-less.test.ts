/**
 * Unit tests for `contrast-less.ts`, sugar over
 * `media("(prefers-contrast: less)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { border } from "../color/border.js";
import { serialize } from "../internal/serialize.js";
import { hover } from "../state/hover.js";

import { contrastLess } from "./contrast-less.js";
import { media } from "./media.js";

describe("contrastLess", () => {
	test("nests the wrapped utility's styles under '@media (prefers-contrast: less)'", async () => {
		expect(await serialize(contrastLess(border("neutral")))).toMatch(
			/@media \(prefers-contrast: less\) \{[\s\S]*border-color: var\(--ui-neutral-border\)/,
		);
	});

	test("produces the identical stylesheet media('(prefers-contrast: less)', input) would", async () => {
		expect(await serialize(contrastLess(border("neutral")))).toBe(
			await serialize(media("(prefers-contrast: less)", border("neutral"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(contrastLess(hover(bg("brand.tint"))))).toMatch(
			/@media \(prefers-contrast: less\) \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});

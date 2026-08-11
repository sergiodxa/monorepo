/**
 * Unit tests for `contrast-less.ts`, sugar over
 * `media("(prefers-contrast: less)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { serialize } from "../internal/serialize";
import { hover } from "../state/hover";

import { contrastLess } from "./contrast-less";
import { media } from "./media";

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

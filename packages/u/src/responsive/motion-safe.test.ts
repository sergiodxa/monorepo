/**
 * Unit tests for `motion-safe.ts`, sugar over
 * `media("(prefers-reduced-motion: no-preference)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { raw } from "../general/raw.js";
import { serialize } from "../internal/serialize.js";
import { hover } from "../state/hover.js";

import { media } from "./media.js";
import { motionSafe } from "./motion-safe.js";

describe("motionSafe", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-motion: no-preference)'", async () => {
		expect(await serialize(motionSafe(raw({ transitionDuration: "150ms" })))).toMatch(
			/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*transition-duration: 150ms/,
		);
	});

	test("produces the identical stylesheet media('(prefers-reduced-motion: no-preference)', input) would", async () => {
		expect(await serialize(motionSafe(bg("neutral.solid")))).toBe(
			await serialize(media("(prefers-reduced-motion: no-preference)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(motionSafe(hover(bg("brand.tint"))))).toMatch(
			/@media \(prefers-reduced-motion: no-preference\) \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});

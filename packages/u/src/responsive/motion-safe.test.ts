/**
 * Unit tests for `motion-safe.ts`, sugar over
 * `media("(prefers-reduced-motion: no-preference)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { raw } from "../general/raw";
import { serialize } from "../internal/serialize";
import { hover } from "../state/hover";

import { media } from "./media";
import { motionSafe } from "./motion-safe";

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

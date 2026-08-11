/**
 * Unit tests for `motion-reduce.ts`, sugar over
 * `media("(prefers-reduced-motion: reduce)", input)`.
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
import { motionReduce } from "./motion-reduce";

describe("motionReduce", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-motion: reduce)'", async () => {
		expect(await serialize(motionReduce(raw({ transitionDuration: "0s" })))).toMatch(
			/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*transition-duration: 0s/,
		);
	});

	test("produces the identical stylesheet media('(prefers-reduced-motion: reduce)', input) would", async () => {
		expect(await serialize(motionReduce(bg("neutral.solid")))).toBe(
			await serialize(media("(prefers-reduced-motion: reduce)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", async () => {
		expect(await serialize(motionReduce(hover(bg("brand.tint"))))).toMatch(
			/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*&:hover \{[\s\S]*background-color: var\(--ui-brand-bg-tint\)/,
		);
	});
});

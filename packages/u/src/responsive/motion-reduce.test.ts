/**
 * Unit tests for `motion-reduce.ts`, sugar over
 * `media("(prefers-reduced-motion: reduce)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { raw } from "../general/raw";
import { hover } from "../state/hover";

import { media } from "./media";
import { motionReduce } from "./motion-reduce";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("motionReduce", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-motion: reduce)'", () => {
		expect(styles(motionReduce(raw({ transitionDuration: "0s" })))).toEqual({
			"@media (prefers-reduced-motion: reduce)": { transitionDuration: "0s" },
		});
	});

	test("produces the identical shape media('(prefers-reduced-motion: reduce)', input) would", () => {
		expect(styles(motionReduce(bg("neutral.solid")))).toEqual(
			styles(media("(prefers-reduced-motion: reduce)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(motionReduce(hover(bg("brand.tint"))))).toEqual({
			"@media (prefers-reduced-motion: reduce)": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});

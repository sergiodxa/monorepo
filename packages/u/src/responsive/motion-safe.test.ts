/**
 * Unit tests for `motion-safe.ts`, sugar over
 * `media("(prefers-reduced-motion: no-preference)", input)`.
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
import { motionSafe } from "./motion-safe";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("motionSafe", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-motion: no-preference)'", () => {
		expect(styles(motionSafe(raw({ transitionDuration: "150ms" })))).toEqual({
			"@media (prefers-reduced-motion: no-preference)": { transitionDuration: "150ms" },
		});
	});

	test("produces the identical shape media('(prefers-reduced-motion: no-preference)', input) would", () => {
		expect(styles(motionSafe(bg("neutral.solid")))).toEqual(
			styles(media("(prefers-reduced-motion: no-preference)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(motionSafe(hover(bg("brand.tint"))))).toEqual({
			"@media (prefers-reduced-motion: no-preference)": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});

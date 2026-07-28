/**
 * Unit tests for `transparency-safe.ts`, sugar over
 * `media("(prefers-reduced-transparency: no-preference)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { hover } from "../state/hover";

import { media } from "./media";
import { transparencySafe } from "./transparency-safe";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transparencySafe", () => {
	test("nests the wrapped utility's styles under '@media (prefers-reduced-transparency: no-preference)'", () => {
		expect(styles(transparencySafe(bg("neutral.solid")))).toEqual({
			"@media (prefers-reduced-transparency: no-preference)": {
				backgroundColor: "var(--ui-neutral-bg-solid)",
			},
		});
	});

	test("produces the identical shape media('(prefers-reduced-transparency: no-preference)', input) would", () => {
		expect(styles(transparencySafe(bg("neutral.solid")))).toEqual(
			styles(media("(prefers-reduced-transparency: no-preference)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(transparencySafe(hover(bg("brand.tint"))))).toEqual({
			"@media (prefers-reduced-transparency: no-preference)": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});

/**
 * Unit tests for `forced-colors.ts`, sugar over
 * `media("(forced-colors: active)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { raw } from "../general/raw";
import { hover } from "../state/hover";

import { forcedColors } from "./forced-colors";
import { media } from "./media";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("forcedColors", () => {
	test("nests the wrapped utility's styles under '@media (forced-colors: active)'", () => {
		expect(styles(forcedColors(raw({ forcedColorAdjust: "none" })))).toEqual({
			"@media (forced-colors: active)": { forcedColorAdjust: "none" },
		});
	});

	test("produces the identical shape media('(forced-colors: active)', input) would", () => {
		expect(styles(forcedColors(bg("neutral.solid")))).toEqual(
			styles(media("(forced-colors: active)", bg("neutral.solid"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(forcedColors(hover(bg("brand.tint"))))).toEqual({
			"@media (forced-colors: active)": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});

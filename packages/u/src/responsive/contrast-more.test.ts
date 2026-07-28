/**
 * Unit tests for `contrast-more.ts`, sugar over
 * `media("(prefers-contrast: more)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { fg } from "../color/fg";
import { hover } from "../state/hover";

import { contrastMore } from "./contrast-more";
import { media } from "./media";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("contrastMore", () => {
	test("nests the wrapped utility's styles under '@media (prefers-contrast: more)'", () => {
		expect(styles(contrastMore(fg("neutral.emphasis")))).toEqual({
			"@media (prefers-contrast: more)": { color: "var(--ui-neutral-fg-emphasis)" },
		});
	});

	test("produces the identical shape media('(prefers-contrast: more)', input) would", () => {
		expect(styles(contrastMore(fg("neutral.emphasis")))).toEqual(
			styles(media("(prefers-contrast: more)", fg("neutral.emphasis"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(contrastMore(hover(bg("brand.tint"))))).toEqual({
			"@media (prefers-contrast: more)": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});

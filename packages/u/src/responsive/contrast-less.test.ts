/**
 * Unit tests for `contrast-less.ts`, sugar over
 * `media("(prefers-contrast: less)", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "../color/bg";
import { border } from "../color/border";
import { hover } from "../state/hover";

import { contrastLess } from "./contrast-less";
import { media } from "./media";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("contrastLess", () => {
	test("nests the wrapped utility's styles under '@media (prefers-contrast: less)'", () => {
		expect(styles(contrastLess(border("neutral")))).toEqual({
			"@media (prefers-contrast: less)": { borderColor: "var(--ui-neutral-border)" },
		});
	});

	test("produces the identical shape media('(prefers-contrast: less)', input) would", () => {
		expect(styles(contrastLess(border("neutral")))).toEqual(
			styles(media("(prefers-contrast: less)", border("neutral"))),
		);
	});

	test("composes with a nested utility, keeping the nested selector inside the at-rule", () => {
		expect(styles(contrastLess(hover(bg("brand.tint"))))).toEqual({
			"@media (prefers-contrast: less)": {
				"&:hover": { backgroundColor: "var(--ui-brand-bg-tint)" },
			},
		});
	});
});

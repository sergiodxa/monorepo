import type { CSSMixinDescriptor } from "remix/ui";

/**
 * Covers `graphicHostStyle()` as pure `css()` output: the exact property set
 * and values a leading graphic slot mixes into its own host element.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { graphicHostStyle } from "./graphic-host";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("graphicHostStyle", () => {
	test("is a shrink-resistant, nudged-down, current-colored mixin", () => {
		expect(styles(graphicHostStyle())).toEqual({
			flexShrink: "0",
			marginBlockStart: "0.125rem",
			color: "currentColor",
		});
	});

	test("carries exactly the three declarations, nothing else", () => {
		expect(Object.keys(styles(graphicHostStyle())).sort()).toEqual(
			["color", "flexShrink", "marginBlockStart"].sort(),
		);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(graphicHostStyle()).not.toBe(graphicHostStyle());
	});
});

import type { CSSMixinDescriptor } from "remix/ui";

/**
 * Covers `legendToggle()` as pure `css()` output: the exact rule block a
 * chart root composes to hide a categorical slot once its paired legend's
 * matching checkbox item is unchecked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { CHART_COLOR_SLOT_COUNT } from "./chart-palette.js";
import { legendToggle } from "./legend-toggle.js";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe(legendToggle.name, () => {
	test("hides each slot when its matching legend item is unchecked", () => {
		expect(styles(legendToggle())).toEqual({
			"&:has(~ [data-slot='legend'] label:nth-of-type(1):not(:has(input:checked))) [data-color='1']":
				{ display: "none" },
			"&:has(~ [data-slot='legend'] label:nth-of-type(2):not(:has(input:checked))) [data-color='2']":
				{ display: "none" },
			"&:has(~ [data-slot='legend'] label:nth-of-type(3):not(:has(input:checked))) [data-color='3']":
				{ display: "none" },
			"&:has(~ [data-slot='legend'] label:nth-of-type(4):not(:has(input:checked))) [data-color='4']":
				{ display: "none" },
			"&:has(~ [data-slot='legend'] label:nth-of-type(5):not(:has(input:checked))) [data-color='5']":
				{ display: "none" },
			"&:has(~ [data-slot='legend'] label:nth-of-type(6):not(:has(input:checked))) [data-color='6']":
				{ display: "none" },
			"&:has(~ [data-slot='legend'] label:nth-of-type(7):not(:has(input:checked))) [data-color='7']":
				{ display: "none" },
			"&:has(~ [data-slot='legend'] label:nth-of-type(8):not(:has(input:checked))) [data-color='8']":
				{ display: "none" },
		});
	});

	test("generates exactly one rule per categorical slot", () => {
		expect(Object.keys(styles(legendToggle()))).toHaveLength(CHART_COLOR_SLOT_COUNT);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(legendToggle()).not.toBe(legendToggle());
	});
});

/**
 * Covers {@link chartPalette} as pure `css()` output: the exact rule block
 * painting one property from whichever categorical slot an element's own
 * `data-color` attribute names, under both the default host selector and a
 * descendant combinator.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { CHART_COLOR_SLOT_COUNT, chartPalette } from "./chart-palette";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("CHART_COLOR_SLOT_COUNT", () => {
	test("spans eight categorical slots", () => {
		expect(CHART_COLOR_SLOT_COUNT).toBe(8);
	});
});

describe(chartPalette.name, () => {
	test("paints the host element itself by default, one rule per slot", () => {
		expect(styles(chartPalette("color"))).toEqual({
			'&[data-color="1"]': { color: "var(--ui-chart-1)" },
			'&[data-color="2"]': { color: "var(--ui-chart-2)" },
			'&[data-color="3"]': { color: "var(--ui-chart-3)" },
			'&[data-color="4"]': { color: "var(--ui-chart-4)" },
			'&[data-color="5"]': { color: "var(--ui-chart-5)" },
			'&[data-color="6"]': { color: "var(--ui-chart-6)" },
			'&[data-color="7"]': { color: "var(--ui-chart-7)" },
			'&[data-color="8"]': { color: "var(--ui-chart-8)" },
		});
	});

	test("matches a descendant instead of the host when given a space combinator", () => {
		expect(styles(chartPalette("fill", " "))).toEqual({
			'& [data-color="1"]': { fill: "var(--ui-chart-1)" },
			'& [data-color="2"]': { fill: "var(--ui-chart-2)" },
			'& [data-color="3"]': { fill: "var(--ui-chart-3)" },
			'& [data-color="4"]': { fill: "var(--ui-chart-4)" },
			'& [data-color="5"]': { fill: "var(--ui-chart-5)" },
			'& [data-color="6"]': { fill: "var(--ui-chart-6)" },
			'& [data-color="7"]': { fill: "var(--ui-chart-7)" },
			'& [data-color="8"]': { fill: "var(--ui-chart-8)" },
		});
	});

	test("sets whichever property is asked for", () => {
		expect(styles(chartPalette("backgroundColor"))).toEqual({
			'&[data-color="1"]': { backgroundColor: "var(--ui-chart-1)" },
			'&[data-color="2"]': { backgroundColor: "var(--ui-chart-2)" },
			'&[data-color="3"]': { backgroundColor: "var(--ui-chart-3)" },
			'&[data-color="4"]': { backgroundColor: "var(--ui-chart-4)" },
			'&[data-color="5"]': { backgroundColor: "var(--ui-chart-5)" },
			'&[data-color="6"]': { backgroundColor: "var(--ui-chart-6)" },
			'&[data-color="7"]': { backgroundColor: "var(--ui-chart-7)" },
			'&[data-color="8"]': { backgroundColor: "var(--ui-chart-8)" },
		});
	});

	test("generates exactly one rule per categorical slot", () => {
		expect(Object.keys(styles(chartPalette("color")))).toHaveLength(CHART_COLOR_SLOT_COUNT);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(chartPalette("color")).not.toBe(chartPalette("color"));
	});
});

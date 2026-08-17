/**
 * Covers {@link interactiveTransition} as pure `css()` output: the exact
 * transition-property list, and its duration/easing sourced from the
 * animation layer's shared tokens rather than a restated literal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor } from "remix/ui";

import { describe, expect, test } from "vitest";

import { durations, easings } from "../animations/tokens";

import { interactiveTransition } from "./interactive-transition";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("interactiveTransition", () => {
	test("exposes exactly the transition-property/timing-function/duration triplet", () => {
		expect(Object.keys(styles(interactiveTransition())).sort()).toEqual(
			["transitionDuration", "transitionProperty", "transitionTimingFunction"].sort(),
		);
	});

	test("lists every property an interactive control's state changes animate", () => {
		expect(styles(interactiveTransition()).transitionProperty).toBe(
			"color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
		);
	});

	test("times its duration off the animation layer's fast token rather than a restated literal", () => {
		expect(styles(interactiveTransition()).transitionDuration).toBe(`${durations.fast}ms`);
	});

	test("eases off the animation layer's standard curve rather than a restated literal", () => {
		expect(styles(interactiveTransition()).transitionTimingFunction).toBe(easings.standard);
	});
});

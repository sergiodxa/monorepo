import type { CSSMixinDescriptor } from "remix/ui";

/**
 * Covers {@link rtlAwareGradientDirection} as pure `css()` output: the exact
 * property set and values every rangeable gradient track composes into its
 * own host `mix` array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { rtlAwareGradientDirection } from "./rtl-aware-gradient-direction.js";

function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("rtlAwareGradientDirection", () => {
	test("sets the property to right by default", () => {
		expect(styles(rtlAwareGradientDirection("--ui-color-slider-track-direction"))).toMatchObject({
			"--ui-color-slider-track-direction": "right",
		});
	});

	test("flips the same property to left under &:dir(rtl)", () => {
		expect(styles(rtlAwareGradientDirection("--ui-color-slider-track-direction"))).toEqual({
			"--ui-color-slider-track-direction": "right",
			"&:dir(rtl)": {
				"--ui-color-slider-track-direction": "left",
			},
		});
	});

	test("keys every declaration off whatever property name is passed in", () => {
		expect(styles(rtlAwareGradientDirection("--ui-color-wheel-track-direction"))).toEqual({
			"--ui-color-wheel-track-direction": "right",
			"&:dir(rtl)": {
				"--ui-color-wheel-track-direction": "left",
			},
		});
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(rtlAwareGradientDirection("--ui-color-slider-track-direction")).not.toBe(
			rtlAwareGradientDirection("--ui-color-slider-track-direction"),
		);
	});
});

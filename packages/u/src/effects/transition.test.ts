/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { transition } from "./transition";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transition", () => {
	test("defaults to the standard easing and a 150ms duration", () => {
		expect(styles(transition("color, background-color"))).toEqual({
			transitionProperty: "color, background-color",
			transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
			transitionDuration: "150ms",
		});
	});

	test("a numeric duration is treated as milliseconds", () => {
		expect(styles(transition("transform", { duration: 200 }))).toEqual({
			transitionProperty: "transform",
			transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
			transitionDuration: "200ms",
		});
	});

	test("a string duration passes through unchanged", () => {
		expect(styles(transition("opacity", { duration: "0s" }))).toEqual({
			transitionProperty: "opacity",
			transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
			transitionDuration: "0s",
		});
	});

	test("a custom easing overrides the default curve", () => {
		expect(styles(transition("box-shadow", { easing: "linear" }))).toEqual({
			transitionProperty: "box-shadow",
			transitionTimingFunction: "linear",
			transitionDuration: "150ms",
		});
	});
});

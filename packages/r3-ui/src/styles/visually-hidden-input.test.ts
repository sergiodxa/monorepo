/**
 * Covers {@link visuallyHiddenInput} as pure `css()` output: the exact
 * property set and values every compound option composes into its hidden
 * input's own `mix` array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { visuallyHiddenInput } from "./visually-hidden-input";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("visuallyHiddenInput", () => {
	test("clips the input to a single, borderless, absolutely positioned pixel", () => {
		expect(styles(visuallyHiddenInput())).toEqual({
			position: "absolute",
			inlineSize: "1px",
			blockSize: "1px",
			padding: "0",
			margin: "-1px",
			overflow: "hidden",
			clip: "rect(0, 0, 0, 0)",
			whiteSpace: "nowrap",
			borderWidth: "0",
		});
	});

	test("carries exactly the nine clipping properties, nothing else", () => {
		expect(Object.keys(styles(visuallyHiddenInput())).sort()).toEqual(
			[
				"position",
				"inlineSize",
				"blockSize",
				"padding",
				"margin",
				"overflow",
				"clip",
				"whiteSpace",
				"borderWidth",
			].sort(),
		);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(visuallyHiddenInput()).not.toBe(visuallyHiddenInput());
	});
});

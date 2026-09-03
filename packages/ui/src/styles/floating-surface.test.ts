import type { CSSMixinDescriptor } from "remix/ui";

/**
 * Covers {@link floatingSurface} as pure `css()` output: the exact property
 * set and values every floating surface composes into its own host `mix`
 * array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { floatingSurface } from "./floating-surface.js";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("floatingSurface", () => {
	test("is a large, rounded, solid 1px neutral border with a neutral tint and an elevation shadow", () => {
		expect(styles(floatingSurface())).toEqual({
			borderRadius: "var(--ui-radius-lg, 0.5rem)",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "var(--ui-neutral-border)",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			boxShadow:
				"var(--ui-shadow-md, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
		});
	});

	test("carries exactly the six chrome properties, nothing else", () => {
		expect(Object.keys(styles(floatingSurface())).sort()).toEqual(
			[
				"backgroundColor",
				"borderColor",
				"borderRadius",
				"borderStyle",
				"borderWidth",
				"boxShadow",
			].sort(),
		);
	});

	test("reads its shadow through a semantic custom property rather than a bare literal", () => {
		let boxShadow = styles(floatingSurface()).boxShadow as string;

		expect(boxShadow.startsWith("var(--ui-shadow-md,")).toBe(true);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(floatingSurface()).not.toBe(floatingSurface());
	});
});

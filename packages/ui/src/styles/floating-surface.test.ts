import type { CSSMixinDescriptor } from "remix/component";

/**
 * Covers {@link floatingSurface} and {@link surfaceInset} as pure `css()`
 * output: the edge, tint and elevation every floating surface composes, and
 * the padding and concentric radius a surface of rounded rows derives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import {
	concentricRadius,
	floatingSurface,
	SHADOW_RING,
	surfaceInset,
	surfacePadding,
} from "./floating-surface.js";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("floatingSurface", () => {
	test("is a large, rounded surface whose edge is a ring shadow over a transparent border", () => {
		expect(styles(floatingSurface())).toEqual({
			borderRadius: "var(--ui-radius-lg, 0.5rem)",
			borderWidth: "1px",
			borderStyle: "solid",
			borderColor: "transparent",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			"--ui-box-shadow-elevation":
				"var(--ui-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1))",
			"--ui-box-shadow-ring": SHADOW_RING,
			boxShadow: "var(--ui-box-shadow-ring, 0 0 #0000), var(--ui-box-shadow-elevation, 0 0 #0000)",
		});
	});

	test("reads its ring from the theme's ring token with a literal fallback", () => {
		expect(SHADOW_RING.startsWith("var(--ui-shadow-ring, 0 0 0 1px")).toBe(true);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(floatingSurface()).not.toBe(floatingSurface());
	});
});

describe("surfaceInset", () => {
	test("pads by the surface padding token and rounds concentric with md rows", () => {
		expect(styles(surfaceInset())).toEqual({
			padding: "var(--ui-surface-padding, 0.25rem)",
			borderRadius:
				"calc(var(--ui-radius-md, 0.375rem) + var(--ui-surface-padding, 0.25rem) + 1px)",
		});
	});

	test("scales padding and radius from the same source", () => {
		let padding = "calc(var(--ui-surface-padding, 0.25rem) * 2)";

		expect(styles(surfaceInset({ scale: 2 }))).toEqual({
			padding,
			borderRadius: `calc(var(--ui-radius-md, 0.375rem) + ${padding} + 1px)`,
		});
	});
});

describe("concentricRadius", () => {
	test("adds the padding to the rows' radius", () => {
		expect(concentricRadius(surfacePadding(1), "var(--ui-radius-sm, 0.25rem)")).toBe(
			"calc(var(--ui-radius-sm, 0.25rem) + var(--ui-surface-padding, 0.25rem) + 1px)",
		);
	});
});

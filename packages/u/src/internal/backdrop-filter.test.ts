/**
 * Unit tests for the shared backdrop-filter-composability foundation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { backdropFilterFunction, COMPOSITE_BACKDROP_FILTER } from "./backdrop-filter";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("backdropFilterFunction", () => {
	test("sets the given custom property plus the shared composite backdropFilter value, on both the standard and Webkit-prefixed properties", () => {
		expect(styles(backdropFilterFunction({ blur: "12px" }))).toEqual({
			"--ui-backdrop-blur": "12px",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("sets multiple custom properties in one call", () => {
		expect(styles(backdropFilterFunction({ blur: "12px", saturate: "1.4" }))).toEqual({
			"--ui-backdrop-blur": "12px",
			"--ui-backdrop-saturate": "1.4",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("the hue-rotate function reads a dash-cased variable from its camel-cased key", () => {
		expect(styles(backdropFilterFunction({ hueRotate: "90deg" }))).toEqual({
			"--ui-backdrop-hue-rotate": "90deg",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("every backdrop-filter function's variable appears in the composite with an identity fallback", () => {
		expect(COMPOSITE_BACKDROP_FILTER).toContain("blur(var(--ui-backdrop-blur, 0px))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("brightness(var(--ui-backdrop-brightness, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("contrast(var(--ui-backdrop-contrast, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("grayscale(var(--ui-backdrop-grayscale, 0))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("invert(var(--ui-backdrop-invert, 0))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("opacity(var(--ui-backdrop-opacity, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("saturate(var(--ui-backdrop-saturate, 1))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain("sepia(var(--ui-backdrop-sepia, 0))");
		expect(COMPOSITE_BACKDROP_FILTER).toContain(
			"drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))",
		);
	});

	test("the composite's function order matches the filter composite's", () => {
		expect(COMPOSITE_BACKDROP_FILTER).toBe(
			[
				"blur(var(--ui-backdrop-blur, 0px))",
				"brightness(var(--ui-backdrop-brightness, 1))",
				"contrast(var(--ui-backdrop-contrast, 1))",
				"grayscale(var(--ui-backdrop-grayscale, 0))",
				"hue-rotate(var(--ui-backdrop-hue-rotate, 0deg))",
				"invert(var(--ui-backdrop-invert, 0))",
				"opacity(var(--ui-backdrop-opacity, 1))",
				"saturate(var(--ui-backdrop-saturate, 1))",
				"sepia(var(--ui-backdrop-sepia, 0))",
				"drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))",
			].join(" "),
		);
	});

	test("the composite's function order is fixed, so composition is order-independent at the call site", () => {
		let blurFirst = styles(backdropFilterFunction({ blur: "4px", sepia: "1" })).backdropFilter;
		let sepiaFirst = styles(backdropFilterFunction({ sepia: "1", blur: "4px" })).backdropFilter;

		expect(blurFirst).toBe(sepiaFirst);
	});
});

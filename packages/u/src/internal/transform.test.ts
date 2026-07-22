/**
 * Unit tests for the shared transform-composability foundation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { angle, COMPOSITE_TRANSFORM, scaleFactor, transformFunction } from "./transform";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("angle", () => {
	test("treats a bare number as degrees", () => {
		expect(angle(45)).toBe("45deg");
	});

	test("passes a string through unchanged", () => {
		expect(angle("0.25turn")).toBe("0.25turn");
	});
});

describe("scaleFactor", () => {
	test("stringifies a bare number as a unitless factor", () => {
		expect(scaleFactor(1.5)).toBe("1.5");
	});

	test("passes a string through unchanged", () => {
		expect(scaleFactor("150%")).toBe("150%");
	});
});

describe("transformFunction", () => {
	test("sets the given custom properties plus the shared composite transform value", () => {
		expect(styles(transformFunction({ rotate: "45deg" }))).toEqual({
			"--ui-rotate": "45deg",
			transform: COMPOSITE_TRANSFORM,
		});
	});

	test("sets multiple custom properties in one call", () => {
		expect(styles(transformFunction({ scaleX: "1.5", scaleY: "1.5" }))).toEqual({
			"--ui-scale-x": "1.5",
			"--ui-scale-y": "1.5",
			transform: COMPOSITE_TRANSFORM,
		});
	});

	test("every transform function's variable appears in the composite with an identity fallback", () => {
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-translate-x, 0)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-translate-y, 0)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-rotate, 0deg)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-rotate-x, 0deg)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-rotate-y, 0deg)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-scale-x, 1)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-scale-y, 1)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-skew-x, 0deg)");
		expect(COMPOSITE_TRANSFORM).toContain("var(--ui-skew-y, 0deg)");
	});
});

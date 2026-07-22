/**
 * Unit tests for `translateX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { translateX } from "./translate-x";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("translateX", () => {
	test("resolves a spacing-scale value into --ui-translate-x plus the composite transform", () => {
		expect(styles(translateX(4))).toEqual({
			"--ui-translate-x": "calc(var(--ui-spacing, 0.25rem) * 4)",
			transform: COMPOSITE_TRANSFORM,
		});
	});

	test("passes a raw CSS length through unchanged", () => {
		expect(styles(translateX("10px"))).toEqual({
			"--ui-translate-x": "10px",
			transform: COMPOSITE_TRANSFORM,
		});
	});
});

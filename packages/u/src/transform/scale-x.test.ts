/**
 * Unit tests for `scaleX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { scaleX } from "./scale-x";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scaleX", () => {
	test("stringifies a bare number as a unitless factor", () => {
		expect(styles(scaleX(1.5))).toEqual({ "--ui-scale-x": "1.5", transform: COMPOSITE_TRANSFORM });
	});

	test("passes a string through unchanged", () => {
		expect(styles(scaleX("150%"))).toEqual({
			"--ui-scale-x": "150%",
			transform: COMPOSITE_TRANSFORM,
		});
	});
});

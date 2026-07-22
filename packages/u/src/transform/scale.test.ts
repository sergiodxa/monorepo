/**
 * Unit tests for `scale()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { scale } from "./scale";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scale", () => {
	test("sets both scaleX and scaleY to the same factor", () => {
		expect(styles(scale(1.5))).toEqual({
			"--ui-scale-x": "1.5",
			"--ui-scale-y": "1.5",
			transform: COMPOSITE_TRANSFORM,
		});
	});
});

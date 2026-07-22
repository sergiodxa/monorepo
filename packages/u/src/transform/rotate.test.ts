/**
 * Unit tests for `rotate()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { rotate } from "./rotate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("rotate", () => {
	test("treats a bare number as degrees", () => {
		expect(styles(rotate(45))).toEqual({ "--ui-rotate": "45deg", transform: COMPOSITE_TRANSFORM });
	});

	test("passes a string through unchanged", () => {
		expect(styles(rotate("0.25turn"))).toEqual({
			"--ui-rotate": "0.25turn",
			transform: COMPOSITE_TRANSFORM,
		});
	});
});

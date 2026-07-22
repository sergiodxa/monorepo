/**
 * Unit tests for `rotateY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { rotateY } from "./rotate-y";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("rotateY", () => {
	test("treats a bare number as degrees", () => {
		expect(styles(rotateY(180))).toEqual({
			"--ui-rotate-y": "180deg",
			transform: COMPOSITE_TRANSFORM,
		});
	});
});

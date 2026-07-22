/**
 * Unit tests for `skewY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { skewY } from "./skew-y";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("skewY", () => {
	test("treats a bare number as degrees", () => {
		expect(styles(skewY(10))).toEqual({ "--ui-skew-y": "10deg", transform: COMPOSITE_TRANSFORM });
	});
});

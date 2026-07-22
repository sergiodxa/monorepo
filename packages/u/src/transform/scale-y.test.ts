/**
 * Unit tests for `scaleY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { scaleY } from "./scale-y";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scaleY", () => {
	test("stringifies a bare number as a unitless factor", () => {
		expect(styles(scaleY(1.5))).toEqual({ "--ui-scale-y": "1.5", transform: COMPOSITE_TRANSFORM });
	});
});

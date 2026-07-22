/**
 * Unit tests for `backfaceVisibility()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { backfaceVisibility } from "./backface-visibility";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("backfaceVisibility", () => {
	test("defaults to hidden", () => {
		expect(styles(backfaceVisibility())).toEqual({ backfaceVisibility: "hidden" });
	});

	test("accepts an explicit value", () => {
		expect(styles(backfaceVisibility("visible"))).toEqual({ backfaceVisibility: "visible" });
	});
});

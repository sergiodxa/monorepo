/**
 * Unit tests for `overflowInline()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overflowInline } from "./overflow-inline";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("overflowInline", () => {
	test("defaults to hidden", () => {
		expect(styles(overflowInline())).toEqual({ overflowInline: "hidden" });
	});

	test("accepts an explicit value", () => {
		expect(styles(overflowInline("auto"))).toEqual({ overflowInline: "auto" });
	});
});

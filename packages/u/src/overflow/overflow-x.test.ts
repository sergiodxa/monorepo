/**
 * Unit tests for `overflowX()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overflowX } from "./overflow-x";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("overflowX", () => {
	test("defaults to hidden", () => {
		expect(styles(overflowX())).toEqual({ overflowX: "hidden" });
	});

	test("accepts an explicit value", () => {
		expect(styles(overflowX("auto"))).toEqual({ overflowX: "auto" });
	});
});

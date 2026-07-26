/**
 * Unit tests for `overflowBlock()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overflowBlock } from "./overflow-block";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("overflowBlock", () => {
	test("defaults to hidden", () => {
		expect(styles(overflowBlock())).toEqual({ overflowBlock: "hidden" });
	});

	test("accepts an explicit value", () => {
		expect(styles(overflowBlock("auto"))).toEqual({ overflowBlock: "auto" });
	});
});

/**
 * Unit tests for `pb()`'s 1/2-value `padding-block` shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { pb } from "./pb";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("pb", () => {
	test("one value applies both block edges", () => {
		expect(styles(pb(4))).toEqual({
			paddingBlock: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block-start then block-end", () => {
		expect(styles(pb(1, 2))).toEqual({
			paddingBlock: "calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2)",
		});
	});
});

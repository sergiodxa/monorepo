/**
 * Unit tests for `mb()`'s 1/2-value `margin-block` shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mb } from "./mb";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mb", () => {
	test("one value applies both block edges", () => {
		expect(styles(mb(4))).toEqual({
			marginBlock: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block-start then block-end, accepting 'auto'", () => {
		expect(styles(mb(4, "auto"))).toEqual({
			marginBlock: "calc(var(--ui-spacing, 0.25rem) * 4) auto",
		});
	});
});

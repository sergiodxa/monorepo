/**
 * Unit tests for `mbe()`'s `margin-block-end` declaration, including
 * `"auto"` for block-axis centering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mbe } from "./mbe";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mbe", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(mbe(4))).toEqual({
			marginBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("passes 'auto' through unchanged", () => {
		expect(styles(mbe("auto"))).toEqual({ marginBlockEnd: "auto" });
	});
});

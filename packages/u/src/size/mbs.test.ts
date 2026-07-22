/**
 * Unit tests for `mbs()`'s `margin-block-start` declaration, including
 * `"auto"` for block-axis centering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mbs } from "./mbs";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mbs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(mbs(4))).toEqual({
			marginBlockStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("passes 'auto' through unchanged", () => {
		expect(styles(mbs("auto"))).toEqual({ marginBlockStart: "auto" });
	});
});

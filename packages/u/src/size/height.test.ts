/**
 * Unit tests for `height()`'s physical `height` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { height } from "./height";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("height", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(height(4))).toEqual({
			height: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(height("full"))).toEqual({ height: "100%" });
	});

	test("passes 'fit-content' through unchanged", () => {
		expect(styles(height("fit-content"))).toEqual({ height: "fit-content" });
	});
});

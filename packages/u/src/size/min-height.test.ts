/**
 * Unit tests for `minHeight()`'s physical `min-height` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { minHeight } from "./min-height";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("minHeight", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(minHeight(4))).toEqual({
			minHeight: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(minHeight("full"))).toEqual({ minHeight: "100%" });
	});

	test("passes 'fit-content' through unchanged", () => {
		expect(styles(minHeight("fit-content"))).toEqual({
			minHeight: "fit-content",
		});
	});
});

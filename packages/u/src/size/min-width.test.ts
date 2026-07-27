/**
 * Unit tests for `minWidth()`'s physical `min-width` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { minWidth } from "./min-width";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("minWidth", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(minWidth(4))).toEqual({
			minWidth: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(minWidth("full"))).toEqual({ minWidth: "100%" });
	});

	test("passes 'fit-content' through unchanged", () => {
		expect(styles(minWidth("fit-content"))).toEqual({
			minWidth: "fit-content",
		});
	});
});

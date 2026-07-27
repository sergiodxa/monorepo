/**
 * Unit tests for `maxHeight()`'s physical `max-height` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { maxHeight } from "./max-height";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("maxHeight", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(maxHeight(4))).toEqual({
			maxHeight: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(maxHeight("full"))).toEqual({ maxHeight: "100%" });
	});

	test("passes 'fit-content' through unchanged", () => {
		expect(styles(maxHeight("fit-content"))).toEqual({
			maxHeight: "fit-content",
		});
	});
});

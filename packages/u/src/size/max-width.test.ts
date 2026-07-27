/**
 * Unit tests for `maxWidth()`'s physical `max-width` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { maxWidth } from "./max-width";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("maxWidth", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(maxWidth(4))).toEqual({
			maxWidth: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(maxWidth("full"))).toEqual({ maxWidth: "100%" });
	});

	test("passes 'fit-content' through unchanged", () => {
		expect(styles(maxWidth("fit-content"))).toEqual({
			maxWidth: "fit-content",
		});
	});
});

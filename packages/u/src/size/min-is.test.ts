/**
 * Unit tests for `minIs()`'s `min-inline-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { minIs } from "./min-is";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("minIs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(minIs(0))).toEqual({
			minInlineSize: "calc(var(--ui-spacing, 0.25rem) * 0)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(minIs("full"))).toEqual({ minInlineSize: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(minIs("60ch"))).toEqual({ minInlineSize: "60ch" });
	});
});

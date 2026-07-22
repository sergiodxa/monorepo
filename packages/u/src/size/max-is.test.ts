/**
 * Unit tests for `maxIs()`'s `max-inline-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { maxIs } from "./max-is";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("maxIs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(maxIs(4))).toEqual({
			maxInlineSize: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(maxIs("full"))).toEqual({ maxInlineSize: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(maxIs("60ch"))).toEqual({ maxInlineSize: "60ch" });
	});
});

/**
 * Unit tests for `is()`'s `inline-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { is } from "./is";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("is", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(is(4))).toEqual({
			inlineSize: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(is("full"))).toEqual({ inlineSize: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(is("60ch"))).toEqual({ inlineSize: "60ch" });
	});
});

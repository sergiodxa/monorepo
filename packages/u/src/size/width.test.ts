/**
 * Unit tests for `width()`'s physical `width` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { width } from "./width";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("width", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(width(4))).toEqual({
			width: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(width("full"))).toEqual({ width: "100%" });
	});

	test("passes 'fit-content' through unchanged", () => {
		expect(styles(width("fit-content"))).toEqual({ width: "fit-content" });
	});
});

/**
 * Unit tests for `insBottom()`'s physical `bottom` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { insBottom } from "./ins-bottom";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("insBottom", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(insBottom(4))).toEqual({ bottom: "calc(var(--ui-spacing, 0.25rem) * 4)" });
	});

	test("accepts 'auto'", () => {
		expect(styles(insBottom("auto"))).toEqual({ bottom: "auto" });
	});

	test("accepts 'full'", () => {
		expect(styles(insBottom("full"))).toEqual({ bottom: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(insBottom("13px"))).toEqual({ bottom: "13px" });
	});
});

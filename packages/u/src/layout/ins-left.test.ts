/**
 * Unit tests for `insLeft()`'s physical `left` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { insLeft } from "./ins-left";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("insLeft", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(insLeft(4))).toEqual({ left: "calc(var(--ui-spacing, 0.25rem) * 4)" });
	});

	test("accepts 'auto'", () => {
		expect(styles(insLeft("auto"))).toEqual({ left: "auto" });
	});

	test("accepts 'full'", () => {
		expect(styles(insLeft("full"))).toEqual({ left: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(insLeft("13px"))).toEqual({ left: "13px" });
	});
});

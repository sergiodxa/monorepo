/**
 * Unit tests for `insTop()`'s physical `top` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { insTop } from "./ins-top";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("insTop", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(insTop(4))).toEqual({ top: "calc(var(--ui-spacing, 0.25rem) * 4)" });
	});

	test("accepts 'auto'", () => {
		expect(styles(insTop("auto"))).toEqual({ top: "auto" });
	});

	test("accepts 'full'", () => {
		expect(styles(insTop("full"))).toEqual({ top: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(insTop("13px"))).toEqual({ top: "13px" });
	});
});

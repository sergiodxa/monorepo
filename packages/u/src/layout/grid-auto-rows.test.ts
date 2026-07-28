/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { gridAutoRows } from "./grid-auto-rows";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("gridAutoRows", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(gridAutoRows(24))).toEqual({
			gridAutoRows: "calc(var(--ui-spacing, 0.25rem) * 24)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(gridAutoRows("full"))).toEqual({ gridAutoRows: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(gridAutoRows("6rem"))).toEqual({ gridAutoRows: "6rem" });
	});

	test("passes an intrinsic keyword through unchanged", () => {
		expect(styles(gridAutoRows("min-content"))).toEqual({ gridAutoRows: "min-content" });
	});

	test("passes a minmax() clause through unchanged", () => {
		expect(styles(gridAutoRows("minmax(6rem, auto)"))).toEqual({
			gridAutoRows: "minmax(6rem, auto)",
		});
	});
});

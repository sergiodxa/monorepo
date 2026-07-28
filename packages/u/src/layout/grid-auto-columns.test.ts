/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { gridAutoColumns } from "./grid-auto-columns";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("gridAutoColumns", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(gridAutoColumns(40))).toEqual({
			gridAutoColumns: "calc(var(--ui-spacing, 0.25rem) * 40)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(gridAutoColumns("full"))).toEqual({ gridAutoColumns: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(gridAutoColumns("10rem"))).toEqual({ gridAutoColumns: "10rem" });
	});

	test("passes an intrinsic keyword through unchanged", () => {
		expect(styles(gridAutoColumns("max-content"))).toEqual({ gridAutoColumns: "max-content" });
	});

	test("passes a minmax() clause through unchanged", () => {
		expect(styles(gridAutoColumns("minmax(10rem, 1fr)"))).toEqual({
			gridAutoColumns: "minmax(10rem, 1fr)",
		});
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fillOpacity } from "./fill-opacity";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fillOpacity", () => {
	test("converts a 0-100 integer to the CSS 0-1 range", () => {
		expect(styles(fillOpacity(50))).toEqual({ fillOpacity: 0.5 });
	});

	test("100 converts to the fully opaque 1", () => {
		expect(styles(fillOpacity(100))).toEqual({ fillOpacity: 1 });
	});

	test("0 converts to the fully transparent 0", () => {
		expect(styles(fillOpacity(0))).toEqual({ fillOpacity: 0 });
	});

	test("a string passes through unchanged", () => {
		expect(styles(fillOpacity("var(--chart-fill-opacity)"))).toEqual({
			fillOpacity: "var(--chart-fill-opacity)",
		});
	});
});

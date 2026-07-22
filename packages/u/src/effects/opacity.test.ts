/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { opacity } from "./opacity";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("opacity", () => {
	test("converts a 0-100 integer to the CSS 0-1 range", () => {
		expect(styles(opacity(50))).toEqual({ opacity: 0.5 });
	});

	test("100 converts to the fully opaque 1", () => {
		expect(styles(opacity(100))).toEqual({ opacity: 1 });
	});

	test("0 converts to the fully transparent 0", () => {
		expect(styles(opacity(0))).toEqual({ opacity: 0 });
	});
});

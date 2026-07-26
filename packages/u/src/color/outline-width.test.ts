/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { outlineWidth } from "./outline-width";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("outlineWidth", () => {
	test("a bare number sets the width in pixels", () => {
		expect(styles(outlineWidth(4))).toEqual({ outlineWidth: "4px" });
	});

	test("a string passes through unchanged", () => {
		expect(styles(outlineWidth("0.25rem"))).toEqual({ outlineWidth: "0.25rem" });
	});

	test("sets only outlineWidth, no color or style", () => {
		let result = styles(outlineWidth(4));
		expect(result.outlineColor).toBeUndefined();
		expect(result.outlineStyle).toBeUndefined();
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { outlineStyle } from "./outline-style";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("outlineStyle", () => {
	test("sets the outline style", () => {
		expect(styles(outlineStyle("dashed"))).toEqual({ outlineStyle: "dashed" });
	});

	test("sets only outlineStyle, no color or width", () => {
		let result = styles(outlineStyle("dotted"));
		expect(result.outlineColor).toBeUndefined();
		expect(result.outlineWidth).toBeUndefined();
	});
});

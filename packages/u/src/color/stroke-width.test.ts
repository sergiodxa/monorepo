/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { strokeWidth } from "./stroke-width";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("strokeWidth", () => {
	test("a bare number is a unitless SVG user-unit value", () => {
		expect(styles(strokeWidth(2))).toEqual({ strokeWidth: "2" });
	});

	test("a string passes through unchanged", () => {
		expect(styles(strokeWidth("0.5%"))).toEqual({ strokeWidth: "0.5%" });
	});
});

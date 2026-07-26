/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { textTransform } from "./text-transform";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("textTransform", () => {
	test("applies the given text-transform value", () => {
		expect(styles(textTransform("uppercase"))).toEqual({ textTransform: "uppercase" });
	});

	test("accepts 'none' to remove a transform", () => {
		expect(styles(textTransform("none"))).toEqual({ textTransform: "none" });
	});
});

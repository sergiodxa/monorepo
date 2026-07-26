/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { textDecoration } from "./text-decoration";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("textDecoration", () => {
	test("applies the given text-decoration-line value", () => {
		expect(styles(textDecoration("underline"))).toEqual({ textDecorationLine: "underline" });
	});

	test("accepts 'none' to remove a decoration", () => {
		expect(styles(textDecoration("none"))).toEqual({ textDecorationLine: "none" });
	});
});

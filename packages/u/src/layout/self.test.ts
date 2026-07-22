/**
 * Unit tests for `self()`'s default and explicit `align-self` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { self } from "./self";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("self", () => {
	test("defaults to auto", () => {
		expect(styles(self())).toEqual({ alignSelf: "auto" });
	});

	test("accepts center", () => {
		expect(styles(self("center"))).toEqual({ alignSelf: "center" });
	});

	test("accepts stretch", () => {
		expect(styles(self("stretch"))).toEqual({ alignSelf: "stretch" });
	});
});

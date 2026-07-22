/**
 * Unit tests for `items()`'s default and explicit `align-items` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { items } from "./items";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("items", () => {
	test("defaults to stretch", () => {
		expect(styles(items())).toEqual({ alignItems: "stretch" });
	});

	test("accepts center", () => {
		expect(styles(items("center"))).toEqual({ alignItems: "center" });
	});

	test("accepts baseline", () => {
		expect(styles(items("baseline"))).toEqual({ alignItems: "baseline" });
	});
});

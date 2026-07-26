/**
 * Unit tests for `visibility()`'s default and explicit values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { visibility } from "./visibility";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("visibility", () => {
	test("no-arg defaults to visible", () => {
		expect(styles(visibility())).toEqual({ visibility: "visible" });
	});

	test("accepts hidden", () => {
		expect(styles(visibility("hidden"))).toEqual({ visibility: "hidden" });
	});

	test("accepts collapse", () => {
		expect(styles(visibility("collapse"))).toEqual({ visibility: "collapse" });
	});
});

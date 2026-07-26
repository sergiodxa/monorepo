/**
 * Unit tests for `translateProperty()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { translateProperty } from "./translate-property";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("translateProperty", () => {
	test("passes a two-axis percentage shorthand through unchanged", () => {
		expect(styles(translateProperty("0 -50%"))).toEqual({ translate: "0 -50%" });
	});

	test("passes the opposite-axis percentage shorthand through unchanged", () => {
		expect(styles(translateProperty("-50% 0"))).toEqual({ translate: "-50% 0" });
	});
});

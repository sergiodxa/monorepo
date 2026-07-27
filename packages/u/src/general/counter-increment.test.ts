/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { counterIncrement } from "./counter-increment";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("counterIncrement", () => {
	test("no value falls back to CSS's own default", () => {
		expect(styles(counterIncrement("section"))).toEqual({ counterIncrement: "section" });
	});

	test("an explicit increment value", () => {
		expect(styles(counterIncrement("section", 2))).toEqual({ counterIncrement: "section 2" });
	});

	test("a negative increment value", () => {
		expect(styles(counterIncrement("countdown", -1))).toEqual({
			counterIncrement: "countdown -1",
		});
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { counterReset } from "./counter-reset";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("counterReset", () => {
	test("no value falls back to CSS's own default", () => {
		expect(styles(counterReset("section"))).toEqual({ counterReset: "section" });
	});

	test("an explicit starting value", () => {
		expect(styles(counterReset("section", 0))).toEqual({ counterReset: "section 0" });
	});

	test("a non-zero starting value", () => {
		expect(styles(counterReset("chapter", 5))).toEqual({ counterReset: "chapter 5" });
	});
});

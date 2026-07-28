/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fieldSizing } from "./field-sizing";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fieldSizing", () => {
	test("defaults to content", () => {
		expect(styles(fieldSizing())).toEqual({ fieldSizing: "content" });
	});

	test("'content'", () => {
		expect(styles(fieldSizing("content"))).toEqual({ fieldSizing: "content" });
	});

	test("'fixed'", () => {
		expect(styles(fieldSizing("fixed"))).toEqual({ fieldSizing: "fixed" });
	});
});

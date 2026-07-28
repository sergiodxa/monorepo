/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { contain } from "./contain";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("contain", () => {
	test("defaults to content", () => {
		expect(styles(contain())).toEqual({ contain: "content" });
	});

	test("'none'", () => {
		expect(styles(contain("none"))).toEqual({ contain: "none" });
	});

	test("'strict'", () => {
		expect(styles(contain("strict"))).toEqual({ contain: "strict" });
	});

	test("'size'", () => {
		expect(styles(contain("size"))).toEqual({ contain: "size" });
	});

	test("'inline-size'", () => {
		expect(styles(contain("inline-size"))).toEqual({ contain: "inline-size" });
	});

	test("'layout'", () => {
		expect(styles(contain("layout"))).toEqual({ contain: "layout" });
	});

	test("'style'", () => {
		expect(styles(contain("style"))).toEqual({ contain: "style" });
	});

	test("'paint'", () => {
		expect(styles(contain("paint"))).toEqual({ contain: "paint" });
	});

	test("a space-separated combination passes through unchanged", () => {
		expect(styles(contain("layout paint"))).toEqual({ contain: "layout paint" });
	});

	test("does not reserve an intrinsic size the way virtualize() does", () => {
		expect(styles(contain("strict"))).not.toHaveProperty("containIntrinsicSize");
	});
});

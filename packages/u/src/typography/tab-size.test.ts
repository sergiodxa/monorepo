/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { tabSize } from "./tab-size";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("tabSize", () => {
	test("no-arg defaults to 2", () => {
		expect(styles(tabSize())).toEqual({ tabSize: "2" });
	});

	/* Stringified, not left as a number: a number reaches the style serializer as
	a length and comes out `2px`, which sizes the tab in pixels rather than in
	characters. */
	test("a number is emitted unitless", () => {
		expect(styles(tabSize(4))).toEqual({ tabSize: "4" });
	});

	test("zero", () => {
		expect(styles(tabSize(0))).toEqual({ tabSize: "0" });
	});

	test("a length string passes through", () => {
		expect(styles(tabSize("4ch"))).toEqual({ tabSize: "4ch" });
	});
});

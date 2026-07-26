/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { listStyle } from "./list-style";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("listStyle", () => {
	test("no-arg defaults to 'none'", () => {
		expect(styles(listStyle())).toEqual({ listStyle: "none" });
	});

	test("an explicit value", () => {
		expect(styles(listStyle("decimal"))).toEqual({ listStyle: "decimal" });
	});

	test("an arbitrary custom-counter-style string", () => {
		expect(styles(listStyle("thumbs"))).toEqual({ listStyle: "thumbs" });
	});
});

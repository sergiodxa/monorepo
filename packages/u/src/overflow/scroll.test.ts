/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scroll } from "./scroll";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scroll", () => {
	test("no-arg defaults to both axes", () => {
		expect(styles(scroll())).toEqual({ overflowX: "auto", overflowY: "auto" });
	});

	test("the x axis", () => {
		expect(styles(scroll("x"))).toEqual({ overflowX: "auto" });
	});

	test("the y axis", () => {
		expect(styles(scroll("y"))).toEqual({ overflowY: "auto" });
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { transitionProperty } from "./transition-property";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transitionProperty", () => {
	test("sets only transition-property", () => {
		expect(styles(transitionProperty("transform"))).toEqual({
			transitionProperty: "transform",
		});
	});

	test("passes through a multi-property list unchanged", () => {
		expect(styles(transitionProperty("color, background-color"))).toEqual({
			transitionProperty: "color, background-color",
		});
	});
});

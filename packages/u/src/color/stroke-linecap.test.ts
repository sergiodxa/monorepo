/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { strokeLinecap } from "./stroke-linecap";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("strokeLinecap", () => {
	test("sets the stroke linecap", () => {
		expect(styles(strokeLinecap("round"))).toEqual({ strokeLinecap: "round" });
	});

	test("accepts butt", () => {
		expect(styles(strokeLinecap("butt"))).toEqual({ strokeLinecap: "butt" });
	});

	test("accepts square", () => {
		expect(styles(strokeLinecap("square"))).toEqual({ strokeLinecap: "square" });
	});
});

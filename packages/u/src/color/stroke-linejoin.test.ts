/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { strokeLinejoin } from "./stroke-linejoin";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("strokeLinejoin", () => {
	test("sets the stroke linejoin", () => {
		expect(styles(strokeLinejoin("round"))).toEqual({ strokeLinejoin: "round" });
	});

	test("accepts bevel", () => {
		expect(styles(strokeLinejoin("bevel"))).toEqual({ strokeLinejoin: "bevel" });
	});

	test("accepts miter", () => {
		expect(styles(strokeLinejoin("miter"))).toEqual({ strokeLinejoin: "miter" });
	});
});

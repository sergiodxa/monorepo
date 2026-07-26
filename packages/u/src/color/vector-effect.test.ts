/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { vectorEffect } from "./vector-effect";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("vectorEffect", () => {
	test("sets the vector effect", () => {
		expect(styles(vectorEffect("non-scaling-stroke"))).toEqual({
			vectorEffect: "non-scaling-stroke",
		});
	});

	test("accepts none", () => {
		expect(styles(vectorEffect("none"))).toEqual({ vectorEffect: "none" });
	});

	test("accepts non-scaling-size", () => {
		expect(styles(vectorEffect("non-scaling-size"))).toEqual({
			vectorEffect: "non-scaling-size",
		});
	});

	test("accepts non-rotation", () => {
		expect(styles(vectorEffect("non-rotation"))).toEqual({ vectorEffect: "non-rotation" });
	});

	test("accepts fixed-position", () => {
		expect(styles(vectorEffect("fixed-position"))).toEqual({ vectorEffect: "fixed-position" });
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollSnapType } from "./scroll-snap-type";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollSnapType", () => {
	test("no-arg defaults to inline mandatory", () => {
		expect(styles(scrollSnapType())).toEqual({ scrollSnapType: "inline mandatory" });
	});

	test("an explicit logical axis", () => {
		expect(styles(scrollSnapType("block"))).toEqual({ scrollSnapType: "block mandatory" });
	});

	test("an explicit strictness", () => {
		expect(styles(scrollSnapType("inline", "proximity"))).toEqual({
			scrollSnapType: "inline proximity",
		});
	});

	test("the both axis", () => {
		expect(styles(scrollSnapType("both", "proximity"))).toEqual({
			scrollSnapType: "both proximity",
		});
	});

	test("the physical axes", () => {
		expect(styles(scrollSnapType("x"))).toEqual({ scrollSnapType: "x mandatory" });
		expect(styles(scrollSnapType("y"))).toEqual({ scrollSnapType: "y mandatory" });
	});

	test("the none axis drops the strictness segment", () => {
		expect(styles(scrollSnapType("none"))).toEqual({ scrollSnapType: "none" });
	});

	test("the none axis ignores an explicit strictness", () => {
		expect(styles(scrollSnapType("none", "proximity"))).toEqual({ scrollSnapType: "none" });
	});
});

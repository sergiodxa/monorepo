/**
 * Unit tests for `perspective()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { perspective } from "./perspective";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("perspective", () => {
	test("defaults to 800px", () => {
		expect(styles(perspective())).toEqual({ perspective: "800px" });
	});

	test("treats a bare number as pixels", () => {
		expect(styles(perspective(400))).toEqual({ perspective: "400px" });
	});

	test("treats zero as pixels", () => {
		expect(styles(perspective(0))).toEqual({ perspective: "0px" });
	});

	test("passes the none keyword through unchanged", () => {
		expect(styles(perspective("none"))).toEqual({ perspective: "none" });
	});

	test("passes a raw string length through unchanged", () => {
		expect(styles(perspective("50rem"))).toEqual({ perspective: "50rem" });
	});
});

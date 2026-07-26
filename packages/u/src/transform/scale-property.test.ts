/**
 * Unit tests for `scaleProperty()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scaleProperty } from "./scale-property";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scaleProperty", () => {
	test("passes a raw string value through unchanged", () => {
		expect(styles(scaleProperty("1"))).toEqual({ scale: "1" });
	});

	test("passes the none keyword through unchanged", () => {
		expect(styles(scaleProperty("none"))).toEqual({ scale: "none" });
	});

	test("passes a fractional string value through unchanged", () => {
		expect(styles(scaleProperty("0.95"))).toEqual({ scale: "0.95" });
	});

	test("passes another fractional string value through unchanged", () => {
		expect(styles(scaleProperty("0.98"))).toEqual({ scale: "0.98" });
	});

	test("stringifies a bare number", () => {
		expect(styles(scaleProperty(0.95))).toEqual({ scale: "0.95" });
	});
});

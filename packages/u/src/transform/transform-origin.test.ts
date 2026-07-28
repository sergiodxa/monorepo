/**
 * Unit tests for `transformOrigin()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { transformOrigin } from "./transform-origin";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transformOrigin", () => {
	test("defaults to center", () => {
		expect(styles(transformOrigin())).toEqual({ transformOrigin: "center" });
	});

	test("accepts a single edge keyword", () => {
		expect(styles(transformOrigin("left"))).toEqual({ transformOrigin: "left" });
	});

	test("accepts a two-keyword corner", () => {
		expect(styles(transformOrigin("bottom right"))).toEqual({
			transformOrigin: "bottom right",
		});
	});

	test("passes a percentage pair through unchanged", () => {
		expect(styles(transformOrigin("25% 75%"))).toEqual({ transformOrigin: "25% 75%" });
	});

	test("passes the three-value 3D form through unchanged", () => {
		expect(styles(transformOrigin("50% 50% 8px"))).toEqual({
			transformOrigin: "50% 50% 8px",
		});
	});

	test("passes a custom property reference through unchanged", () => {
		expect(styles(transformOrigin("var(--ui-origin)"))).toEqual({
			transformOrigin: "var(--ui-origin)",
		});
	});
});

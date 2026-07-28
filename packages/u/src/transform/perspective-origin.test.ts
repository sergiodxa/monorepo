/**
 * Unit tests for `perspectiveOrigin()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { perspectiveOrigin } from "./perspective-origin";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("perspectiveOrigin", () => {
	test("defaults to center", () => {
		expect(styles(perspectiveOrigin())).toEqual({ perspectiveOrigin: "center" });
	});

	test("accepts a single edge keyword", () => {
		expect(styles(perspectiveOrigin("top"))).toEqual({ perspectiveOrigin: "top" });
	});

	test("accepts a two-keyword corner", () => {
		expect(styles(perspectiveOrigin("top left"))).toEqual({ perspectiveOrigin: "top left" });
	});

	test("passes a percentage pair through unchanged", () => {
		expect(styles(perspectiveOrigin("25% 75%"))).toEqual({ perspectiveOrigin: "25% 75%" });
	});

	test("passes a custom property reference through unchanged", () => {
		expect(styles(perspectiveOrigin("var(--ui-origin)"))).toEqual({
			perspectiveOrigin: "var(--ui-origin)",
		});
	});
});

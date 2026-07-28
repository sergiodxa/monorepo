/**
 * Unit tests for `transformStyle()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { transformStyle } from "./transform-style";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transformStyle", () => {
	test("defaults to preserve-3d", () => {
		expect(styles(transformStyle())).toEqual({ transformStyle: "preserve-3d" });
	});

	test("accepts preserve-3d explicitly", () => {
		expect(styles(transformStyle("preserve-3d"))).toEqual({ transformStyle: "preserve-3d" });
	});

	test("accepts flat", () => {
		expect(styles(transformStyle("flat"))).toEqual({ transformStyle: "flat" });
	});

	test("never emits a composite transform declaration", () => {
		expect(styles(transformStyle())).not.toHaveProperty("transform");
	});
});

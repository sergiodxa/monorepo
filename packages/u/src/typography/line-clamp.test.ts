/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { lineClamp } from "./line-clamp";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("lineClamp", () => {
	test("a numeric line count applies the -webkit-line-clamp trick", () => {
		expect(styles(lineClamp(3))).toEqual({
			display: "-webkit-box",
			WebkitBoxOrient: "vertical",
			WebkitLineClamp: 3,
			overflow: "hidden",
		});
	});

	test("emits WebkitBoxOrient and WebkitLineClamp with a capital W, not camelCase webkitBoxOrient", () => {
		let result = styles(lineClamp(2));

		expect(Object.keys(result)).toContain("WebkitBoxOrient");
		expect(Object.keys(result)).toContain("WebkitLineClamp");
		expect(Object.keys(result)).not.toContain("webkitBoxOrient");
		expect(Object.keys(result)).not.toContain("webkitLineClamp");
	});
});

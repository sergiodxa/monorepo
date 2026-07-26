/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { safeAreaPadding } from "./safe-area-padding";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("safeAreaPadding", () => {
	test("defaults the fallback to 0px, on the bottom side", () => {
		expect(styles(safeAreaPadding("bottom"))).toEqual({
			paddingBottom: "env(safe-area-inset-bottom, 0px)",
		});
	});

	test("the top side", () => {
		expect(styles(safeAreaPadding("top"))).toEqual({
			paddingTop: "env(safe-area-inset-top, 0px)",
		});
	});

	test("the left side", () => {
		expect(styles(safeAreaPadding("left"))).toEqual({
			paddingLeft: "env(safe-area-inset-left, 0px)",
		});
	});

	test("the right side", () => {
		expect(styles(safeAreaPadding("right"))).toEqual({
			paddingRight: "env(safe-area-inset-right, 0px)",
		});
	});

	test("an explicit fallback", () => {
		expect(styles(safeAreaPadding("top", "1rem"))).toEqual({
			paddingTop: "env(safe-area-inset-top, 1rem)",
		});
	});
});

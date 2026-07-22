/**
 * Unit tests for `noScrollbar()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { noScrollbar } from "./no-scrollbar";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("noScrollbar", () => {
	test("hides the scrollbar across every browser engine", () => {
		expect(styles(noScrollbar())).toEqual({
			MsOverflowStyle: "none",
			scrollbarWidth: "none",
			"&::-webkit-scrollbar": { display: "none" },
		});
	});
});

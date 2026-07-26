/**
 * Unit tests for `thinScrollbar()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { thinScrollbar } from "./thin-scrollbar";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("thinScrollbar", () => {
	test("requests a thin, layout-stable scrollbar", () => {
		expect(styles(thinScrollbar())).toEqual({
			scrollbarWidth: "thin",
			scrollbarGutter: "stable",
		});
	});
});

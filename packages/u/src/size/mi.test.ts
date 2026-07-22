/**
 * Unit tests for `mi()`'s 1/2-value `margin-inline` shorthand, including the
 * `"auto"` edge form used for inline centering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mi } from "./mi";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mi", () => {
	test("one value applies both inline edges", () => {
		expect(styles(mi(4))).toEqual({
			marginInline: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to inline-start then inline-end, accepting 'auto'", () => {
		expect(styles(mi(4, "auto"))).toEqual({
			marginInline: "calc(var(--ui-spacing, 0.25rem) * 4) auto",
		});
	});
});

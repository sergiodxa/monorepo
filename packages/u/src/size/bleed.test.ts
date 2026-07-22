/**
 * Unit tests for `bleed()`'s negative inline-margin wrapping.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bleed } from "./bleed";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("bleed", () => {
	test("defaults to 4 on the spacing scale", () => {
		expect(styles(bleed())).toEqual({
			marginInline: "calc(-1 * calc(var(--ui-spacing, 0.25rem) * 4))",
		});
	});

	test("wraps an explicit value in the negative calc()", () => {
		expect(styles(bleed(8))).toEqual({
			marginInline: "calc(-1 * calc(var(--ui-spacing, 0.25rem) * 8))",
		});
	});
});

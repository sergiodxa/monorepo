/**
 * Unit tests for `mie()`'s `margin-inline-end` declaration, including
 * `"auto"` for centering against the leading edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mie } from "./mie";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mie", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(mie(4))).toEqual({
			marginInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("passes 'auto' through unchanged", () => {
		expect(styles(mie("auto"))).toEqual({ marginInlineEnd: "auto" });
	});
});

/**
 * Unit tests for `insIe()`'s `inset-inline-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { insIe } from "./ins-ie";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("insIe", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(insIe(4))).toEqual({
			insetInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});

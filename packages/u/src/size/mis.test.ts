/**
 * Unit tests for `mis()`'s `margin-inline-start` declaration, including
 * `"auto"` for centering against the trailing edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mis } from "./mis";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mis", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(mis(4))).toEqual({
			marginInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("passes 'auto' through unchanged", () => {
		expect(styles(mis("auto"))).toEqual({ marginInlineStart: "auto" });
	});
});

/**
 * Unit tests for `marginRight()`'s physical `margin-right` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { marginRight } from "./margin-right";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("marginRight", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(marginRight(4))).toEqual({
			marginRight: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("accepts 'auto'", () => {
		expect(styles(marginRight("auto"))).toEqual({ marginRight: "auto" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(marginRight("13px"))).toEqual({ marginRight: "13px" });
	});
});

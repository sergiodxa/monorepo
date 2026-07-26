/**
 * Unit tests for `marginLeft()`'s physical `margin-left` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { marginLeft } from "./margin-left";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("marginLeft", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(marginLeft(4))).toEqual({
			marginLeft: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("accepts 'auto'", () => {
		expect(styles(marginLeft("auto"))).toEqual({ marginLeft: "auto" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(marginLeft("13px"))).toEqual({ marginLeft: "13px" });
	});
});

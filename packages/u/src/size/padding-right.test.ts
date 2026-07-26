/**
 * Unit tests for `paddingRight()`'s physical `padding-right` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { paddingRight } from "./padding-right";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("paddingRight", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(paddingRight(4))).toEqual({
			paddingRight: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(paddingRight("13px"))).toEqual({ paddingRight: "13px" });
	});

	test("passes a calc()/env() composite through unchanged", () => {
		expect(styles(paddingRight("calc(1.5rem + env(safe-area-inset-right, 0px))"))).toEqual({
			paddingRight: "calc(1.5rem + env(safe-area-inset-right, 0px))",
		});
	});
});

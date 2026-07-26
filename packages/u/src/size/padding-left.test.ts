/**
 * Unit tests for `paddingLeft()`'s physical `padding-left` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { paddingLeft } from "./padding-left";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("paddingLeft", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(paddingLeft(4))).toEqual({
			paddingLeft: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(paddingLeft("13px"))).toEqual({ paddingLeft: "13px" });
	});

	test("passes a calc()/env() composite through unchanged", () => {
		expect(styles(paddingLeft("calc(1.5rem + env(safe-area-inset-left, 0px))"))).toEqual({
			paddingLeft: "calc(1.5rem + env(safe-area-inset-left, 0px))",
		});
	});
});

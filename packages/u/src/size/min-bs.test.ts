/**
 * Unit tests for `minBs()`'s `min-block-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { minBs } from "./min-bs";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("minBs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(minBs(0))).toEqual({
			minBlockSize: "calc(var(--ui-spacing, 0.25rem) * 0)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(minBs("full"))).toEqual({ minBlockSize: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(minBs("60ch"))).toEqual({ minBlockSize: "60ch" });
	});
});

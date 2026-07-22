/**
 * Unit tests for `bs()`'s `block-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bs } from "./bs";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("bs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(bs(4))).toEqual({
			blockSize: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(bs("full"))).toEqual({ blockSize: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(bs("60ch"))).toEqual({ blockSize: "60ch" });
	});
});

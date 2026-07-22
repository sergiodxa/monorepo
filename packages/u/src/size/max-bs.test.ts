/**
 * Unit tests for `maxBs()`'s `max-block-size` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { maxBs } from "./max-bs";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("maxBs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(maxBs(4))).toEqual({
			maxBlockSize: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("resolves 'full' to 100%", () => {
		expect(styles(maxBs("full"))).toEqual({ maxBlockSize: "100%" });
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(styles(maxBs("60ch"))).toEqual({ maxBlockSize: "60ch" });
	});
});

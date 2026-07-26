/**
 * Unit tests for `insBs()`'s `inset-block-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { insBs } from "./ins-bs";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("insBs", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(insBs(4))).toEqual({
			insetBlockStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});

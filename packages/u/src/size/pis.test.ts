/**
 * Unit tests for `pis()`'s `padding-inline-start` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { pis } from "./pis";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("pis", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(pis(4))).toEqual({
			paddingInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});

/**
 * Unit tests for `pbe()`'s `padding-block-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { pbe } from "./pbe";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("pbe", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(pbe(4))).toEqual({
			paddingBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});

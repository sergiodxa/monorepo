/**
 * Unit tests for `pie()`'s `padding-inline-end` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { pie } from "./pie";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("pie", () => {
	test("resolves a spacing-scale number", () => {
		expect(styles(pie(4))).toEqual({
			paddingInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});

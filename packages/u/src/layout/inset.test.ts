/**
 * Unit tests for `inset()`'s 1/2/4-value logical `inset` shorthand
 * resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { inset } from "./inset";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("inset", () => {
	test("one value applies uniformly", () => {
		expect(styles(inset(4))).toEqual({
			inset: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block then inline", () => {
		expect(styles(inset(4, "auto"))).toEqual({
			insetBlock: "calc(var(--ui-spacing, 0.25rem) * 4)",
			insetInline: "auto",
		});
	});

	test("four values map to block-start, inline-end, block-end, inline-start", () => {
		expect(styles(inset(1, 2, 3, 4))).toEqual({
			insetBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			insetInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			insetBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			insetInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});

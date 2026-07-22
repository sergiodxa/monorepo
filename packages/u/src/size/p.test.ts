/**
 * Unit tests for `p()`'s 1/2/4-value logical padding shorthand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "./p";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("p", () => {
	test("one value applies uniformly", () => {
		expect(styles(p(4))).toEqual({
			padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block then inline", () => {
		expect(styles(p(1, 2))).toEqual({
			paddingBlock: "calc(var(--ui-spacing, 0.25rem) * 1)",
			paddingInline: "calc(var(--ui-spacing, 0.25rem) * 2)",
		});
	});

	test("four values map to block-start, inline-end, block-end, inline-start", () => {
		expect(styles(p(1, 2, 3, 4))).toEqual({
			paddingBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			paddingInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			paddingBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			paddingInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});
});

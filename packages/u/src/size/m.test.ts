/**
 * Unit tests for `m()`'s 1/2/4-value logical margin shorthand, including
 * `"auto"` for centering.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { m } from "./m";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("m", () => {
	test("one value applies uniformly", () => {
		expect(styles(m(4))).toEqual({
			margin: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block then inline", () => {
		expect(styles(m(1, 2))).toEqual({
			marginBlock: "calc(var(--ui-spacing, 0.25rem) * 1)",
			marginInline: "calc(var(--ui-spacing, 0.25rem) * 2)",
		});
	});

	test("four values map to block-start, inline-end, block-end, inline-start", () => {
		expect(styles(m(1, 2, 3, 4))).toEqual({
			marginBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			marginInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			marginBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			marginInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("accepts 'auto' anywhere in the 1/2/4-value forms", () => {
		expect(styles(m(4, "auto"))).toEqual({
			marginBlock: "calc(var(--ui-spacing, 0.25rem) * 4)",
			marginInline: "auto",
		});
	});
});

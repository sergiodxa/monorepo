/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollPadding } from "./scroll-padding";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollPadding", () => {
	test("one value applies uniformly", () => {
		expect(styles(scrollPadding(4))).toEqual({
			scrollPadding: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block then inline", () => {
		expect(styles(scrollPadding(16, 0))).toEqual({
			scrollPaddingBlock: "calc(var(--ui-spacing, 0.25rem) * 16)",
			scrollPaddingInline: "calc(var(--ui-spacing, 0.25rem) * 0)",
		});
	});

	test("four values map to block-start, inline-end, block-end, inline-start", () => {
		expect(styles(scrollPadding(1, 2, 3, 4))).toEqual({
			scrollPaddingBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			scrollPaddingInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			scrollPaddingBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			scrollPaddingInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("a raw CSS length passes through", () => {
		expect(styles(scrollPadding("3rem"))).toEqual({ scrollPadding: "3rem" });
	});

	test("throws for an unsupported value count", () => {
		expect(() => scrollPadding(1, 2, 3)).toThrow();
		expect(() => scrollPadding()).toThrow();
	});
});

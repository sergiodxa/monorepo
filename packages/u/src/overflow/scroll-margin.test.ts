/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollMargin } from "./scroll-margin";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollMargin", () => {
	test("one value applies uniformly", () => {
		expect(styles(scrollMargin(4))).toEqual({
			scrollMargin: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block then inline", () => {
		expect(styles(scrollMargin(16, 0))).toEqual({
			scrollMarginBlock: "calc(var(--ui-spacing, 0.25rem) * 16)",
			scrollMarginInline: "calc(var(--ui-spacing, 0.25rem) * 0)",
		});
	});

	test("four values map to block-start, inline-end, block-end, inline-start", () => {
		expect(styles(scrollMargin(1, 2, 3, 4))).toEqual({
			scrollMarginBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			scrollMarginInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			scrollMarginBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			scrollMarginInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("a raw CSS length passes through", () => {
		expect(styles(scrollMargin("3rem"))).toEqual({ scrollMargin: "3rem" });
	});

	test("throws for an unsupported value count", () => {
		expect(() => scrollMargin(1, 2, 3)).toThrow();
		expect(() => scrollMargin()).toThrow();
	});
});

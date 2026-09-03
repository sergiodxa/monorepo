/**
 * Unit tests for the shared logical-box-shorthand resolver behind `p()` and
 * `m()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { resolveBox, resolveEdge } from "./box.js";

describe("resolveBox", () => {
	test("one value applies uniformly", () => {
		expect(resolveBox("padding", [4])).toEqual({
			padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("two values map to block then inline", () => {
		expect(resolveBox("margin", [1, 2])).toEqual({
			marginBlock: "calc(var(--ui-spacing, 0.25rem) * 1)",
			marginInline: "calc(var(--ui-spacing, 0.25rem) * 2)",
		});
	});

	test("four values map to block-start, inline-end, block-end, inline-start", () => {
		expect(resolveBox("padding", [1, 2, 3, 4])).toEqual({
			paddingBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			paddingInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			paddingBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			paddingInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("margin accepts 'auto' anywhere in the 1/2/4-value forms", () => {
		expect(resolveBox("margin", [4, "auto"])).toEqual({
			marginBlock: "calc(var(--ui-spacing, 0.25rem) * 4)",
			marginInline: "auto",
		});
	});

	test("the scrollPadding prefix builds camelCase scroll-padding keys", () => {
		expect(resolveBox("scrollPadding", [4])).toEqual({
			scrollPadding: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
		expect(resolveBox("scrollPadding", [1, 2])).toEqual({
			scrollPaddingBlock: "calc(var(--ui-spacing, 0.25rem) * 1)",
			scrollPaddingInline: "calc(var(--ui-spacing, 0.25rem) * 2)",
		});
		expect(resolveBox("scrollPadding", [1, 2, 3, 4])).toEqual({
			scrollPaddingBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			scrollPaddingInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			scrollPaddingBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			scrollPaddingInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("the scrollMargin prefix builds camelCase scroll-margin keys", () => {
		expect(resolveBox("scrollMargin", [4])).toEqual({
			scrollMargin: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
		expect(resolveBox("scrollMargin", [1, 2])).toEqual({
			scrollMarginBlock: "calc(var(--ui-spacing, 0.25rem) * 1)",
			scrollMarginInline: "calc(var(--ui-spacing, 0.25rem) * 2)",
		});
		expect(resolveBox("scrollMargin", [1, 2, 3, 4])).toEqual({
			scrollMarginBlockStart: "calc(var(--ui-spacing, 0.25rem) * 1)",
			scrollMarginInlineEnd: "calc(var(--ui-spacing, 0.25rem) * 2)",
			scrollMarginBlockEnd: "calc(var(--ui-spacing, 0.25rem) * 3)",
			scrollMarginInlineStart: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("throws for an unsupported value count", () => {
		expect(() => resolveBox("padding", [1, 2, 3])).toThrow();
		expect(() => resolveBox("padding", [])).toThrow();
		expect(() => resolveBox("scrollPadding", [1, 2, 3])).toThrow();
		expect(() => resolveBox("scrollMargin", [])).toThrow();
	});
});

describe("resolveEdge", () => {
	test("one value resolves to a single length", () => {
		expect(resolveEdge([4])).toBe("calc(var(--ui-spacing, 0.25rem) * 4)");
	});

	test("two values resolve to a space-joined pair", () => {
		expect(resolveEdge([4, "auto"])).toBe("calc(var(--ui-spacing, 0.25rem) * 4) auto");
	});
});

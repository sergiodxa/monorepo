/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { text } from "./text";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("text", () => {
	test("a named size resolves fontSize and its paired lineHeight", () => {
		expect(styles(text("lg"))).toEqual({
			fontSize: "var(--ui-text-lg, 1.125rem)",
			lineHeight: "var(--ui-leading-lg, calc(1.75 / 1.125))",
		});
	});

	test("another named size resolves its own fallback and paired lineHeight", () => {
		expect(styles(text("9xl"))).toEqual({
			fontSize: "var(--ui-text-9xl, 8rem)",
			lineHeight: "var(--ui-leading-9xl, 1)",
		});
	});

	test("'sm' resolves the exact ratio call sites depend on when sweeping hardcoded font-size/line-height literals", () => {
		expect(styles(text("sm"))).toEqual({
			fontSize: "var(--ui-text-sm, 0.875rem)",
			lineHeight: "var(--ui-leading-sm, calc(1.25 / 0.875))",
		});
	});

	test("'xs' resolves the exact ratio call sites depend on when sweeping hardcoded font-size/line-height literals", () => {
		expect(styles(text("xs"))).toEqual({
			fontSize: "var(--ui-text-xs, 0.75rem)",
			lineHeight: "var(--ui-leading-xs, calc(1 / 0.75))",
		});
	});
});

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
			lineHeight: "var(--ui-leading-lg, 1.5)",
		});
	});

	test("another named size resolves its own fallback and paired lineHeight", () => {
		expect(styles(text("9xl"))).toEqual({
			fontSize: "var(--ui-text-9xl, 8rem)",
			lineHeight: "var(--ui-leading-9xl, 1.5)",
		});
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { font } from "./font";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("font", () => {
	test("a named family resolves fontFamily", () => {
		expect(styles(font("serif"))).toEqual({
			fontFamily: "var(--ui-font-serif, ui-serif, Georgia, serif)",
		});
	});

	test("another named family resolves its own fallback stack", () => {
		expect(styles(font("mono"))).toEqual({
			fontFamily: "var(--ui-font-mono, ui-monospace, SFMono-Regular, monospace)",
		});
	});
});

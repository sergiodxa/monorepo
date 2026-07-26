/**
 * Unit tests for `ringShadow()`, including a byte-for-byte confirmation
 * against `color-swatch-picker.tsx`'s existing `"input:checked ~ &"`
 * selection ring literal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { ringShadow } from "./ring-shadow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("ringShadow", () => {
	test("matches color-swatch-picker.tsx's selection ring literal byte-for-byte", () => {
		expect(styles(ringShadow("primary"))).toEqual({
			boxShadow: "0 0 0 2px var(--ui-primary-bg-solid)",
		});
	});

	test("accepts a numeric width", () => {
		expect(styles(ringShadow("danger", 3))).toEqual({
			boxShadow: "0 0 0 3px var(--ui-danger-bg-solid)",
		});
	});

	test("accepts a string width, passed through unchanged", () => {
		expect(styles(ringShadow("neutral", "0.25rem"))).toEqual({
			boxShadow: "0 0 0 0.25rem var(--ui-neutral-bg-solid)",
		});
	});
});

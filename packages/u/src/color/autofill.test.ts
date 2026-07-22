/**
 * Unit tests for `autofill()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { autofill } from "./autofill";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("autofill", () => {
	test("defaults to the system background/foreground tokens, nested under &:-webkit-autofill", () => {
		expect(styles(autofill())).toEqual({
			"&:-webkit-autofill": {
				boxShadow: "0 0 0 1000px var(--ui-bg, Canvas) inset !important",
				WebkitBoxShadow: "0 0 0 1000px var(--ui-bg, Canvas) inset !important",
				WebkitTextFillColor: "var(--ui-fg, CanvasText) !important",
			},
		});
	});

	test("resolves explicit background and foreground tones", () => {
		expect(styles(autofill("neutral.tint", "neutral"))).toEqual({
			"&:-webkit-autofill": {
				boxShadow: "0 0 0 1000px var(--ui-neutral-bg-tint) inset !important",
				WebkitBoxShadow: "0 0 0 1000px var(--ui-neutral-bg-tint) inset !important",
				WebkitTextFillColor: "var(--ui-neutral-fg) !important",
			},
		});
	});
});

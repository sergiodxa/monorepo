/**
 * Unit tests for `forced-color-adjust.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { forcedColorAdjust } from "./forced-color-adjust";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("forcedColorAdjust", () => {
	test('defaults to "none"', () => {
		expect(styles(forcedColorAdjust())).toEqual({ forcedColorAdjust: "none" });
	});

	test("passes an explicit keyword through", () => {
		expect(styles(forcedColorAdjust("auto"))).toEqual({ forcedColorAdjust: "auto" });
		expect(styles(forcedColorAdjust("preserve-parent-color"))).toEqual({
			forcedColorAdjust: "preserve-parent-color",
		});
	});
});

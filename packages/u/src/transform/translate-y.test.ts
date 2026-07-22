/**
 * Unit tests for `translateY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { COMPOSITE_TRANSFORM } from "../internal/transform";

import { translateY } from "./translate-y";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("translateY", () => {
	test("resolves a spacing-scale value into --ui-translate-y plus the composite transform", () => {
		expect(styles(translateY(4))).toEqual({
			"--ui-translate-y": "calc(var(--ui-spacing, 0.25rem) * 4)",
			transform: COMPOSITE_TRANSFORM,
		});
	});
});

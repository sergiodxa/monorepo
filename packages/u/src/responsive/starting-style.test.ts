/**
 * Unit tests for `starting-style.ts`, the `@starting-style` at-rule wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { opacity } from "../effects/opacity";

import { startingStyle } from "./starting-style";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("startingStyle", () => {
	test("nests the wrapped utility's styles under '@starting-style'", () => {
		expect(styles(startingStyle(opacity(0)))).toEqual({
			"@starting-style": { opacity: 0 },
		});
	});
});

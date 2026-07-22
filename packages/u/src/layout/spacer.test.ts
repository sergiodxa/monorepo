/**
 * Unit tests for `spacer()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { spacer } from "./spacer";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("spacer", () => {
	test("grows and shrinks to fill the available space", () => {
		expect(styles(spacer())).toEqual({ flex: "1 1 auto" });
	});
});

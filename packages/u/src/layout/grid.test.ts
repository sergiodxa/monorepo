/**
 * Unit tests for `grid()`'s fixed `display: grid` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { grid } from "./grid";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("grid", () => {
	test("sets display: grid", () => {
		expect(styles(grid())).toEqual({ display: "grid" });
	});
});

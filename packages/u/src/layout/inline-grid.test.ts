/**
 * Unit tests for `inlineGrid()`'s fixed `display: inline-grid` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { inlineGrid } from "./inline-grid";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("inlineGrid", () => {
	test("sets display: inline-grid", () => {
		expect(styles(inlineGrid())).toEqual({ display: "inline-grid" });
	});
});

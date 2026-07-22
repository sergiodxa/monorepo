/**
 * Unit tests for `hidden()`'s fixed `display: none` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { hidden } from "./hidden";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("hidden", () => {
	test("sets display: none", () => {
		expect(styles(hidden())).toEqual({ display: "none" });
	});
});

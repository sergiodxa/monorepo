/**
 * Unit tests for `inline()`'s fixed `display: inline` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { inline } from "./inline";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("inline", () => {
	test("sets display: inline", () => {
		expect(styles(inline())).toEqual({ display: "inline" });
	});
});

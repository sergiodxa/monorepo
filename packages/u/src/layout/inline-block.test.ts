/**
 * Unit tests for `inlineBlock()`'s fixed `display: inline-block` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { inlineBlock } from "./inline-block";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("inlineBlock", () => {
	test("sets display: inline-block", () => {
		expect(styles(inlineBlock())).toEqual({ display: "inline-block" });
	});
});

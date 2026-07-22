/**
 * Unit tests for `block()`'s fixed `display: block` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { block } from "./block";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("block", () => {
	test("sets display: block", () => {
		expect(styles(block())).toEqual({ display: "block" });
	});
});

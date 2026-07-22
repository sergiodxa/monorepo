/**
 * Unit tests for `flex()`'s fixed `display: flex` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { flex } from "./flex";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("flex", () => {
	test("sets display: flex", () => {
		expect(styles(flex())).toEqual({ display: "flex" });
	});
});

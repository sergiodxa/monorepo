/**
 * Unit tests for `sticky()`'s fixed `position: sticky` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { sticky } from "./sticky";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("sticky", () => {
	test("sets position: sticky", () => {
		expect(styles(sticky())).toEqual({ position: "sticky" });
	});
});

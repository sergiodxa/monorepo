/**
 * Unit tests for `fixed()`'s fixed `position: fixed` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fixed } from "./fixed";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fixed", () => {
	test("sets position: fixed", () => {
		expect(styles(fixed())).toEqual({ position: "fixed" });
	});
});

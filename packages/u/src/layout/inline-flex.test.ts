/**
 * Unit tests for `inlineFlex()`'s fixed `display: inline-flex` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { inlineFlex } from "./inline-flex";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("inlineFlex", () => {
	test("sets display: inline-flex", () => {
		expect(styles(inlineFlex())).toEqual({ display: "inline-flex" });
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { verticalAlign } from "./vertical-align";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("verticalAlign", () => {
	test("sets a known keyword", () => {
		expect(styles(verticalAlign("middle"))).toEqual({ verticalAlign: "middle" });
	});

	test("passes through an arbitrary value unchanged", () => {
		expect(styles(verticalAlign("15%"))).toEqual({ verticalAlign: "15%" });
	});
});

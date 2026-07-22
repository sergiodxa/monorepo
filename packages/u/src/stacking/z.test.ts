/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { z } from "./z";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("z", () => {
	test("sets zIndex from a plain number", () => {
		expect(styles(z(10))).toEqual({ zIndex: 10 });
	});

	test("a different numeric value", () => {
		expect(styles(z(0))).toEqual({ zIndex: 0 });
	});
});

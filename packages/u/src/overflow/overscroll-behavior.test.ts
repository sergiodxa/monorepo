/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { overscrollBehavior } from "./overscroll-behavior";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("overscrollBehavior", () => {
	test("no-arg defaults to contain", () => {
		expect(styles(overscrollBehavior())).toEqual({ overscrollBehavior: "contain" });
	});

	test("none", () => {
		expect(styles(overscrollBehavior("none"))).toEqual({ overscrollBehavior: "none" });
	});

	test("auto", () => {
		expect(styles(overscrollBehavior("auto"))).toEqual({ overscrollBehavior: "auto" });
	});
});

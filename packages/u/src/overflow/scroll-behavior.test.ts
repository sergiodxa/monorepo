/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollBehavior } from "./scroll-behavior";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollBehavior", () => {
	test("no-arg defaults to smooth", () => {
		expect(styles(scrollBehavior())).toEqual({ scrollBehavior: "smooth" });
	});

	test("auto", () => {
		expect(styles(scrollBehavior("auto"))).toEqual({ scrollBehavior: "auto" });
	});
});

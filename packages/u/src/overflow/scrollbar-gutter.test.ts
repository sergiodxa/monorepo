/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollbarGutter } from "./scrollbar-gutter";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollbarGutter", () => {
	test("no-arg defaults to stable", () => {
		expect(styles(scrollbarGutter())).toEqual({ scrollbarGutter: "stable" });
	});

	test("stable both-edges", () => {
		expect(styles(scrollbarGutter("stable both-edges"))).toEqual({
			scrollbarGutter: "stable both-edges",
		});
	});

	test("auto", () => {
		expect(styles(scrollbarGutter("auto"))).toEqual({ scrollbarGutter: "auto" });
	});
});

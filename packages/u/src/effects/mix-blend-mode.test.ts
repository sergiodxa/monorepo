/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { mixBlendMode } from "./mix-blend-mode";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("mixBlendMode", () => {
	test("no-arg defaults to multiply", () => {
		expect(styles(mixBlendMode())).toEqual({ mixBlendMode: "multiply" });
	});

	test("an explicit separable blend mode", () => {
		expect(styles(mixBlendMode("screen"))).toEqual({ mixBlendMode: "screen" });
	});

	test("a non-separable blend mode", () => {
		expect(styles(mixBlendMode("luminosity"))).toEqual({ mixBlendMode: "luminosity" });
	});

	test("a plus-* compositing mode", () => {
		expect(styles(mixBlendMode("plus-lighter"))).toEqual({ mixBlendMode: "plus-lighter" });
	});

	test("normal, the value that opts back out of blending", () => {
		expect(styles(mixBlendMode("normal"))).toEqual({ mixBlendMode: "normal" });
	});
});

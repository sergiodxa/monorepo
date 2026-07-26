/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { positionTryFallbacks } from "./position-try-fallbacks";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("positionTryFallbacks", () => {
	test("sets a single fallback", () => {
		expect(styles(positionTryFallbacks("flip-block"))).toEqual({
			positionTryFallbacks: "flip-block",
		});
	});

	test("joins multiple fallbacks with a comma", () => {
		expect(styles(positionTryFallbacks("flip-block", "flip-inline"))).toEqual({
			positionTryFallbacks: "flip-block, flip-inline",
		});
	});

	test("accepts a custom-position-try reference", () => {
		expect(styles(positionTryFallbacks("--custom-fallback"))).toEqual({
			positionTryFallbacks: "--custom-fallback",
		});
	});
});

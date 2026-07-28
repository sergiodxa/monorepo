/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollSnapStop } from "./scroll-snap-stop";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollSnapStop", () => {
	test("no-arg defaults to always", () => {
		expect(styles(scrollSnapStop())).toEqual({ scrollSnapStop: "always" });
	});

	test("normal", () => {
		expect(styles(scrollSnapStop("normal"))).toEqual({ scrollSnapStop: "normal" });
	});
});

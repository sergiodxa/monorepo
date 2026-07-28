/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { scrollSnapAlign } from "./scroll-snap-align";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("scrollSnapAlign", () => {
	test("no-arg defaults to start", () => {
		expect(styles(scrollSnapAlign())).toEqual({ scrollSnapAlign: "start" });
	});

	test("center", () => {
		expect(styles(scrollSnapAlign("center"))).toEqual({ scrollSnapAlign: "center" });
	});

	test("end", () => {
		expect(styles(scrollSnapAlign("end"))).toEqual({ scrollSnapAlign: "end" });
	});

	test("none", () => {
		expect(styles(scrollSnapAlign("none"))).toEqual({ scrollSnapAlign: "none" });
	});
});

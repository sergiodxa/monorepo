/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { transitionDelay } from "./transition-delay";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transitionDelay", () => {
	test("no-arg defaults to 0s", () => {
		expect(styles(transitionDelay())).toEqual({ transitionDelay: "0s" });
	});

	test("sets only transition-delay", () => {
		expect(styles(transitionDelay("120ms"))).toEqual({ transitionDelay: "120ms" });
	});

	test("passes through an arbitrary delay string unchanged", () => {
		expect(styles(transitionDelay("calc(var(--index) * 40ms)"))).toEqual({
			transitionDelay: "calc(var(--index) * 40ms)",
		});
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { animationDelay } from "./animation-delay";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("animationDelay", () => {
	test("passes the given time value through unchanged", () => {
		expect(styles(animationDelay("150ms"))).toEqual({ animationDelay: "150ms" });
	});

	test("defaults to 0s when no value is given", () => {
		expect(styles(animationDelay())).toEqual({ animationDelay: "0s" });
	});

	test("keeps a negative delay, which seeks into the animation instead of waiting", () => {
		expect(styles(animationDelay("-500ms"))).toEqual({ animationDelay: "-500ms" });
	});

	test("accepts a computed per-item delay for staggering", () => {
		expect(styles(animationDelay(`${2 * 60}ms`))).toEqual({ animationDelay: "120ms" });
	});

	test("emits only animationDelay, never animationName or animationDuration", () => {
		let result = styles(animationDelay("150ms"));

		expect(Object.keys(result)).toEqual(["animationDelay"]);
	});
});

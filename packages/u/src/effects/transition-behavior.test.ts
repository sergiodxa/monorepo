/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { transitionBehavior } from "./transition-behavior";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("transitionBehavior", () => {
	test("sets transition-behavior to 'normal'", () => {
		expect(styles(transitionBehavior("normal"))).toEqual({ transitionBehavior: "normal" });
	});

	test("sets transition-behavior to 'allow-discrete'", () => {
		expect(styles(transitionBehavior("allow-discrete"))).toEqual({
			transitionBehavior: "allow-discrete",
		});
	});
});

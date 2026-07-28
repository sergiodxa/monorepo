/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { contentVisibility } from "./content-visibility";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("contentVisibility", () => {
	test("defaults to auto", () => {
		expect(styles(contentVisibility())).toEqual({ contentVisibility: "auto" });
	});

	test("'visible'", () => {
		expect(styles(contentVisibility("visible"))).toEqual({ contentVisibility: "visible" });
	});

	test("'hidden'", () => {
		expect(styles(contentVisibility("hidden"))).toEqual({ contentVisibility: "hidden" });
	});

	test("does not reserve a placeholder size the way virtualize() does", () => {
		expect(styles(contentVisibility("auto"))).not.toHaveProperty("containIntrinsicSize");
	});
});

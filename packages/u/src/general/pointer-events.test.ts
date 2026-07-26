/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { pointerEvents } from "./pointer-events";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("pointerEvents", () => {
	test("no-arg defaults to 'none'", () => {
		expect(styles(pointerEvents())).toEqual({ pointerEvents: "none" });
	});

	test("an explicit value", () => {
		expect(styles(pointerEvents("auto"))).toEqual({ pointerEvents: "auto" });
	});
});

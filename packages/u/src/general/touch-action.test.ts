/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { touchAction } from "./touch-action";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("touchAction", () => {
	test("no-arg defaults to 'none'", () => {
		expect(styles(touchAction())).toEqual({ touchAction: "none" });
	});

	test("an explicit value", () => {
		expect(styles(touchAction("manipulation"))).toEqual({ touchAction: "manipulation" });
	});

	test("an arbitrary combination of pan values", () => {
		expect(styles(touchAction("pan-x pan-y"))).toEqual({ touchAction: "pan-x pan-y" });
	});
});

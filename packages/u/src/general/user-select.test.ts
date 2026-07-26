/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { userSelect } from "./user-select";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("userSelect", () => {
	test("no-arg defaults to 'none'", () => {
		expect(styles(userSelect())).toEqual({ userSelect: "none" });
	});

	test("an explicit value", () => {
		expect(styles(userSelect("text"))).toEqual({ userSelect: "text" });
	});
});

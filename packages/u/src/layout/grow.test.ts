/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { grow } from "./grow";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("grow", () => {
	test("no-arg defaults to 1", () => {
		expect(styles(grow())).toEqual({ flexGrow: "1" });
	});

	test("an explicit number", () => {
		expect(styles(grow(0))).toEqual({ flexGrow: "0" });
	});
});

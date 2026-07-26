/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { basis } from "./basis";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("basis", () => {
	test("no-arg defaults to auto", () => {
		expect(styles(basis())).toEqual({ flexBasis: "auto" });
	});

	test("a spacing-scale number", () => {
		expect(styles(basis(4))).toEqual({ flexBasis: "calc(var(--ui-spacing, 0.25rem) * 4)" });
	});

	test("a raw percentage string", () => {
		expect(styles(basis("0%"))).toEqual({ flexBasis: "0%" });
	});
});

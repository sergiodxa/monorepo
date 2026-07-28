/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_FILTER } from "../internal/filter";

import { invert } from "./invert";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("invert", () => {
	test("no-arg defaults to a full inversion", () => {
		expect(styles(invert())).toEqual({
			"--ui-filter-invert": "1",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit partial amount", () => {
		expect(styles(invert(0.25))).toEqual({
			"--ui-filter-invert": "0.25",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit string amount passes through unchanged", () => {
		expect(styles(invert("100%"))).toEqual({
			"--ui-filter-invert": "100%",
			filter: COMPOSITE_FILTER,
		});
	});
});

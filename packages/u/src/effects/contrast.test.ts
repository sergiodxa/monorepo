/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_FILTER } from "../internal/filter";

import { contrast } from "./contrast";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("contrast", () => {
	test("no-arg defaults to 1.25", () => {
		expect(styles(contrast())).toEqual({
			"--ui-filter-contrast": "1.25",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit numeric factor", () => {
		expect(styles(contrast(0))).toEqual({
			"--ui-filter-contrast": "0",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit string factor passes through unchanged", () => {
		expect(styles(contrast("125%"))).toEqual({
			"--ui-filter-contrast": "125%",
			filter: COMPOSITE_FILTER,
		});
	});
});

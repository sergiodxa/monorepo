/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_FILTER } from "../internal/filter";

import { brightness } from "./brightness";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("brightness", () => {
	test("no-arg defaults to 1.1", () => {
		expect(styles(brightness())).toEqual({
			"--ui-filter-brightness": "1.1",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit numeric factor", () => {
		expect(styles(brightness(0.5))).toEqual({
			"--ui-filter-brightness": "0.5",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit string factor passes through unchanged", () => {
		expect(styles(brightness("110%"))).toEqual({
			"--ui-filter-brightness": "110%",
			filter: COMPOSITE_FILTER,
		});
	});
});

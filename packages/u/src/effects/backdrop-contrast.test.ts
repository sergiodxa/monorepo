/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";

import { backdropContrast } from "./backdrop-contrast";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("backdropContrast", () => {
	test("no-arg defaults to 1.25", () => {
		expect(styles(backdropContrast())).toEqual({
			"--ui-backdrop-contrast": "1.25",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit numeric factor", () => {
		expect(styles(backdropContrast(0.75))).toEqual({
			"--ui-backdrop-contrast": "0.75",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit string factor passes through unchanged", () => {
		expect(styles(backdropContrast("125%"))).toEqual({
			"--ui-backdrop-contrast": "125%",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});

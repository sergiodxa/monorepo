/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";

import { backdropInvert } from "./backdrop-invert";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("backdropInvert", () => {
	test("no-arg defaults to 1", () => {
		expect(styles(backdropInvert())).toEqual({
			"--ui-backdrop-invert": "1",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit partial amount", () => {
		expect(styles(backdropInvert(0.15))).toEqual({
			"--ui-backdrop-invert": "0.15",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit string amount passes through unchanged", () => {
		expect(styles(backdropInvert("15%"))).toEqual({
			"--ui-backdrop-invert": "15%",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});

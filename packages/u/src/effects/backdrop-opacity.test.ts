/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";

import { backdropOpacity } from "./backdrop-opacity";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("backdropOpacity", () => {
	test("no-arg defaults to 0.5", () => {
		expect(styles(backdropOpacity())).toEqual({
			"--ui-backdrop-opacity": "0.5",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit numeric amount in the native 0-1 range", () => {
		expect(styles(backdropOpacity(0.25))).toEqual({
			"--ui-backdrop-opacity": "0.25",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("a raw percentage string passes through unchanged", () => {
		expect(styles(backdropOpacity("25%"))).toEqual({
			"--ui-backdrop-opacity": "25%",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("it sets the backdrop variable, never the opacity property", () => {
		let result = styles(backdropOpacity()) as Record<string, unknown>;

		expect(result.opacity).toBeUndefined();
	});
});

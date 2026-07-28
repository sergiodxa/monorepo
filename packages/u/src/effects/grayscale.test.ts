/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_FILTER } from "../internal/filter";

import { grayscale } from "./grayscale";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("grayscale", () => {
	test("no-arg defaults to a full conversion", () => {
		expect(styles(grayscale())).toEqual({
			"--ui-filter-grayscale": "1",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit partial amount", () => {
		expect(styles(grayscale(0.5))).toEqual({
			"--ui-filter-grayscale": "0.5",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit string amount passes through unchanged", () => {
		expect(styles(grayscale("60%"))).toEqual({
			"--ui-filter-grayscale": "60%",
			filter: COMPOSITE_FILTER,
		});
	});
});

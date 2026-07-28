/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { merge } from "../internal/descriptor";
import { COMPOSITE_FILTER } from "../internal/filter";

import { blur } from "./blur";
import { grayscale } from "./grayscale";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("blur", () => {
	test("no-arg defaults to the md blur, written to the composite's blur variable", () => {
		expect(styles(blur())).toEqual({
			"--ui-filter-blur": "var(--ui-blur-md, 12px)",
			filter: COMPOSITE_FILTER,
		});
	});

	test("an explicit named blur", () => {
		expect(styles(blur("lg"))).toEqual({
			"--ui-filter-blur": "var(--ui-blur-lg, 24px)",
			filter: COMPOSITE_FILTER,
		});
	});

	test("a raw CSS length passes through unchanged", () => {
		expect(styles(blur("8px"))).toEqual({
			"--ui-filter-blur": "8px",
			filter: COMPOSITE_FILTER,
		});
	});
});

describe("composability with other filter utilities", () => {
	test("composing blur() and grayscale() together sets both variables under the same composite filter", () => {
		let merged = merge(styles(blur("lg")), styles(grayscale()));

		expect(merged).toEqual({
			"--ui-filter-blur": "var(--ui-blur-lg, 24px)",
			"--ui-filter-grayscale": "1",
			filter: COMPOSITE_FILTER,
		});
	});
});

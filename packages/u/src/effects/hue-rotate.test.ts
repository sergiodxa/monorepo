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
import { filterOpacity } from "./filter-opacity";
import { hueRotate } from "./hue-rotate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("hueRotate", () => {
	test("no-arg defaults to 90deg", () => {
		expect(styles(hueRotate())).toEqual({
			"--ui-filter-hue-rotate": "90deg",
			filter: COMPOSITE_FILTER,
		});
	});

	test("a bare number is treated as degrees", () => {
		expect(styles(hueRotate(180))).toEqual({
			"--ui-filter-hue-rotate": "180deg",
			filter: COMPOSITE_FILTER,
		});
	});

	test("a negative number rotates the other way", () => {
		expect(styles(hueRotate(-45))).toEqual({
			"--ui-filter-hue-rotate": "-45deg",
			filter: COMPOSITE_FILTER,
		});
	});

	test("a raw angle string passes through unchanged", () => {
		expect(styles(hueRotate("0.5turn"))).toEqual({
			"--ui-filter-hue-rotate": "0.5turn",
			filter: COMPOSITE_FILTER,
		});
	});
});

describe("composability with other filter utilities", () => {
	test("composing hueRotate(), filterOpacity(), and blur() together sets all three variables under one composite filter", () => {
		let merged = merge(styles(hueRotate()), styles(filterOpacity()), styles(blur("lg")));

		expect(merged).toEqual({
			"--ui-filter-hue-rotate": "90deg",
			"--ui-filter-opacity": "0.5",
			"--ui-filter-blur": "var(--ui-blur-lg, 24px)",
			filter: COMPOSITE_FILTER,
		});
	});
});

/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { merge } from "../internal/descriptor";

import { backdropBrightness } from "./backdrop-brightness";
import { backdropGrayscale } from "./backdrop-grayscale";
import { backdropHueRotate } from "./backdrop-hue-rotate";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("backdropBrightness", () => {
	test("no-arg defaults to 1.1", () => {
		expect(styles(backdropBrightness())).toEqual({
			"--ui-backdrop-brightness": "1.1",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit numeric factor", () => {
		expect(styles(backdropBrightness(0.8))).toEqual({
			"--ui-backdrop-brightness": "0.8",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("an explicit string factor passes through unchanged", () => {
		expect(styles(backdropBrightness("80%"))).toEqual({
			"--ui-backdrop-brightness": "80%",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});

	test("applies unconditionally, with no prefers-reduced-transparency gating", () => {
		expect(Object.keys(styles(backdropBrightness())).sort()).toEqual(
			["--ui-backdrop-brightness", "backdropFilter", "WebkitBackdropFilter"].sort(),
		);
	});
});

describe("composability with other backdrop utilities", () => {
	test("composing three backdrop utilities together sets all three variables under one composite backdropFilter", () => {
		let merged = merge(
			styles(backdropBrightness()),
			styles(backdropGrayscale()),
			styles(backdropHueRotate()),
		);

		expect(merged).toEqual({
			"--ui-backdrop-brightness": "1.1",
			"--ui-backdrop-grayscale": "1",
			"--ui-backdrop-hue-rotate": "90deg",
			backdropFilter: COMPOSITE_BACKDROP_FILTER,
			WebkitBackdropFilter: COMPOSITE_BACKDROP_FILTER,
		});
	});
});

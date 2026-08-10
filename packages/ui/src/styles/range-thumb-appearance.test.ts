/**
 * Covers {@link rangeThumbAppearance} as pure `css()` output: the exact
 * declaration set every single-channel range control's thumb composes into
 * its own `mix` array, with no DOM and no rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { rangeThumbAppearance } from "./range-thumb-appearance";

/** Unwraps a `css()` mixin descriptor back to the style object it was built from. */
function styles(mixin: CSSMixinDescriptor): Record<string, any> {
	return mixin.args[0] as Record<string, any>;
}

describe(rangeThumbAppearance.name, () => {
	test("reads the thumb's own size and border width from the given custom properties", () => {
		let style = styles(
			rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
		);

		expect(style["&::-webkit-slider-thumb"].inlineSize).toBe(
			"var(--ui-slider-thumb-size, 1.25rem)",
		);
		expect(style["&::-webkit-slider-thumb"].blockSize).toBe("var(--ui-slider-thumb-size, 1.25rem)");
		expect(style["&::-webkit-slider-thumb"].borderWidth).toBe(
			"var(--ui-slider-thumb-border-width, 2px)",
		);
		expect(style["&::-moz-range-thumb"].inlineSize).toBe("var(--ui-slider-thumb-size, 1.25rem)");
		expect(style["&::-moz-range-thumb"].blockSize).toBe("var(--ui-slider-thumb-size, 1.25rem)");
		expect(style["&::-moz-range-thumb"].borderWidth).toBe(
			"var(--ui-slider-thumb-border-width, 2px)",
		);
	});

	test("varies only the size and border-width custom property names between two controls", () => {
		let slider = styles(
			rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
		);
		let colorSlider = styles(
			rangeThumbAppearance("--ui-color-slider-thumb-size", "--ui-color-slider-thumb-border-width"),
		);

		expect(slider["&::-webkit-slider-thumb"].inlineSize).not.toBe(
			colorSlider["&::-webkit-slider-thumb"].inlineSize,
		);
		expect(slider["&:active::-webkit-slider-thumb"]).toEqual(
			colorSlider["&:active::-webkit-slider-thumb"],
		);
		expect(slider["&:focus-visible::-webkit-slider-thumb"]).toEqual(
			colorSlider["&:focus-visible::-webkit-slider-thumb"],
		);
		expect(slider["&:disabled::-webkit-slider-thumb"]).toEqual(
			colorSlider["&:disabled::-webkit-slider-thumb"],
		);
		expect(slider["@media (prefers-reduced-motion: reduce)"]).toEqual(
			colorSlider["@media (prefers-reduced-motion: reduce)"],
		);
	});

	test("paints the thumb reset, radius-full shape, and border/fill colors", () => {
		let style = styles(
			rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
		);

		expect(style["&::-webkit-slider-thumb"]).toEqual({
			WebkitAppearance: "none",
			appearance: "none",
			inlineSize: "var(--ui-slider-thumb-size, 1.25rem)",
			blockSize: "var(--ui-slider-thumb-size, 1.25rem)",
			borderRadius: "var(--ui-radius-full, 9999px)",
			borderWidth: "var(--ui-slider-thumb-border-width, 2px)",
			borderStyle: "solid",
			borderColor: "var(--ui-brand-bg-solid)",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
			cursor: "pointer",
			transitionProperty: "box-shadow, scale",
			transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
			transitionDuration: "150ms",
		});
		expect(style["&::-moz-range-thumb"]).toEqual({
			inlineSize: "var(--ui-slider-thumb-size, 1.25rem)",
			blockSize: "var(--ui-slider-thumb-size, 1.25rem)",
			borderRadius: "var(--ui-radius-full, 9999px)",
			borderWidth: "var(--ui-slider-thumb-border-width, 2px)",
			borderStyle: "solid",
			borderColor: "var(--ui-brand-bg-solid)",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
			cursor: "pointer",
			transitionProperty: "box-shadow, scale",
			transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
			transitionDuration: "150ms",
		});
	});

	test("scales the pressed thumb up by 1.1 in both engines", () => {
		let style = styles(
			rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
		);

		expect(style["&:active::-webkit-slider-thumb"]).toEqual({ scale: "1.1" });
		expect(style["&:active::-moz-range-thumb"]).toEqual({ scale: "1.1" });
	});

	test("rings the focus-visible thumb in the primary color in both engines", () => {
		let style = styles(
			rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
		);
		let expected = {
			outlineWidth: "2px",
			outlineStyle: "solid",
			outlineOffset: "2px",
			outlineColor: "var(--ui-brand-ring)",
		};

		expect(style["&:focus-visible::-webkit-slider-thumb"]).toEqual(expected);
		expect(style["&:focus-visible::-moz-range-thumb"]).toEqual(expected);
	});

	test("mutes the disabled thumb's border and drops its shadow in both engines", () => {
		let style = styles(
			rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
		);
		let expected = {
			cursor: "not-allowed",
			boxShadow: "none",
			borderColor: "var(--ui-neutral-border)",
		};

		expect(style["&:disabled::-webkit-slider-thumb"]).toEqual(expected);
		expect(style["&:disabled::-moz-range-thumb"]).toEqual(expected);
	});

	test("collapses both engines' thumb transitions to an instant change under reduced motion", () => {
		let style = styles(
			rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
		);

		expect(style["@media (prefers-reduced-motion: reduce)"]).toEqual({
			"&::-webkit-slider-thumb": { transitionDuration: "0s" },
			"&::-moz-range-thumb": { transitionDuration: "0s" },
		});
	});

	test("returns a fresh mixin descriptor on every call", () => {
		let first = rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width");
		let second = rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width");

		expect(first).not.toBe(second);
		expect(styles(first)).toEqual(styles(second));
	});
});

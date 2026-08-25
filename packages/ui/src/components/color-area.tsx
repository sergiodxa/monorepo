/**
 * A two-dimensional saturation/brightness picking square for a given hue,
 * built from two overlaid native `<input type="range">` elements — one
 * horizontal for saturation, one rotated vertical for brightness — whose
 * native thumbs, each reshaped into a thin line, cross at the picked point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, linearGradient, outline, outlineStyle } from "@pkg/u/color";
import { opacity, ringShadow, rounded, transition, transitionDuration } from "@pkg/u/effects";
import { cursor, pointerEvents, raw } from "@pkg/u/general";
import { absolute, appearance, inlineBlock, inset, relative } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, is, m } from "@pkg/u/size";
import { z } from "@pkg/u/stacking";
import { when } from "@pkg/u/state";
import { scaleProperty } from "@pkg/u/transform";
import { attrs } from "remix/ui";

import { mergeStyle } from "../utils/merge-style";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/** Hue, in degrees, {@link ColorArea} falls back to when `hue` is omitted. */
const DEFAULT_HUE = 0;

/** Lower bound shared by both axis inputs' native `min`. */
const DEFAULT_MIN = 0;

/** Upper bound shared by both axis inputs' native `max`. */
const DEFAULT_MAX = 100;

/** Step shared by both axis inputs' native `step`, applied when a thumb's own `step` is omitted. */
const DEFAULT_STEP = 1;

/**
 * Saturation (x-axis) {@link ColorArea} falls back to when neither
 * `saturation` nor `defaultSaturation` is set — full saturation, so the
 * default picked point starts at the pure-hue edge of the square.
 */
const DEFAULT_SATURATION = 100;

/**
 * Brightness (y-axis) {@link ColorArea} falls back to when neither `value`
 * nor `defaultValue` is set — full brightness, pairing with
 * {@link DEFAULT_SATURATION} for a default picked point at the pure-hue corner.
 */
const DEFAULT_VALUE = 100;

/**
 * `role="group"` applied through {@link attrs} unless a consumer supplies
 * its own `role`, announcing the root as one grouped control to assistive
 * technology despite its two axes riding two separate native inputs.
 */
const DEFAULT_ROLE = "group";

/**
 * Prop types for {@link ColorArea} and its compound parts.
 */
export namespace ColorArea {
	/**
	 * Value {@link ColorArea} stores in component context so its
	 * {@link ColorArea.SaturationThumb} and {@link ColorArea.ValueThumb} share
	 * the same resolved hue, position, and stable ids without repeating them.
	 */
	export interface Context {
		/** Resolved hue, in degrees, the square's background paints for. */
		hue: number;
		/** Resolved saturation (x-axis position), `0`–`100`. */
		saturation: number;
		/** Resolved brightness (y-axis position), `0`–`100`. */
		value: number;
		/** Id shared by {@link ColorArea.SaturationThumb} as its own `id`. */
		saturationThumbId: string;
		/** Id shared by {@link ColorArea.ValueThumb} as its own `id`. */
		valueThumbId: string;
	}

	/**
	 * Props accepted by {@link ColorArea}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Hue, in degrees `0`–`360`, the square's background renders every reachable
		 * saturation/brightness combination for. Defaults to {@link DEFAULT_HUE}.
		 * Typically driven by a hue control alongside this one, re-rendering on change.
		 */
		hue?: number;
		/** Current saturation (x-axis position), `0`–`100`, for a square whose position the consumer tracks itself. */
		saturation?: number;
		/** Starting saturation (x-axis position), `0`–`100`, for a square that never tracks its own position. */
		defaultSaturation?: number;
		/** Current brightness (y-axis position), `0`–`100`, for a square whose position the consumer tracks itself. */
		value?: number;
		/** Starting brightness (y-axis position), `0`–`100`, for a square that never tracks its own position. */
		defaultValue?: number;
	}

	/**
	 * Every native `<input>` attribute except `type` (fixed to `"range"`) and
	 * `role` (the platform's implicit `"slider"`), plus `mix`. Use
	 * `value`/`defaultValue`, `min`/`max`/`step`, and `aria-label` as usual.
	 */
	export interface SaturationThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}

	/**
	 * Every native `<input>` attribute except `type` (fixed to `"range"`) and
	 * `role` (the platform's implicit `"slider"`), plus `mix`. Use
	 * `value`/`defaultValue`, `min`/`max`/`step`, and `aria-label` as usual.
	 */
	export interface ValueThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}
}

/**
 * Renders the root `<div>`'s picking-square background: literal `black`/`white`
 * gradient stops are the fixed brightness/saturation math primaries, and the
 * hue's `hsl()` composes through `bg()`, since it passes `(`-values unchanged.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link ColorArea.Context}.
 * @returns The render function producing the root's markup.
 * @example
 * <ColorArea aria-label={t("colorPicker.area")} hue={210} defaultSaturation={80} defaultValue={70}>
 * 	<ColorArea.SaturationThumb aria-label={t("colorPicker.saturation")} />
 * 	<ColorArea.ValueThumb aria-label={t("colorPicker.brightness")} />
 * </ColorArea>
 */
export function ColorArea(handle: Handle<ColorArea.Props, ColorArea.Context>) {
	return () => {
		let { hue, saturation, defaultSaturation, value, defaultValue, mix, style, ...rest } =
			handle.props;
		let resolvedHue = hue ?? DEFAULT_HUE;
		let resolvedSaturation = saturation ?? defaultSaturation ?? DEFAULT_SATURATION;
		let resolvedValue = value ?? defaultValue ?? DEFAULT_VALUE;
		let resolvedStyle = mergeStyle(style, { "--ui-color-area-hue": resolvedHue });

		warnIfNoAccessibleLabel(
			handle.props,
			"ColorArea: this group needs an `aria-label` describing what it picks — assistive technology has no accessible name for the group its two axis inputs are announced under otherwise.",
		);

		handle.context.set({
			hue: resolvedHue,
			saturation: resolvedSaturation,
			value: resolvedValue,
			saturationThumbId: `${handle.id}-saturation`,
			valueThumbId: `${handle.id}-value`,
		});

		return (
			<div
				data-slot="area"
				{...rest}
				style={resolvedStyle}
				mix={[
					attrs({ role: DEFAULT_ROLE }),
					relative(),
					inlineBlock(),
					is("var(--ui-color-area-size, 16rem)"),
					bs("var(--ui-color-area-size, 16rem)"),
					rounded("md"),
					border({ width: 1, color: "neutral" }),
					overflow(),
					bg({
						image: `${linearGradient("to top", "black", "transparent")}, ${linearGradient("to right", "white", "transparent")}`,
					}),
					bg("hsl(var(--ui-color-area-hue, 0) 100% 50%)"),
					mix,
				]}
			/>
		);
	};
}

/**
 * `direction` stays fixed left-to-right regardless of the page's own `dir`,
 * matching the root gradient's physical axes; only this thumb's own line
 * accepts pointer input, so elsewhere a click reaches the axis line beneath it.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the thumb's markup.
 * @example
 * <ColorArea.SaturationThumb aria-label={t("colorPicker.saturation")} />
 */
ColorArea.SaturationThumb = function ColorAreaSaturationThumb(
	handle: Handle<ColorArea.SaturationThumbProps>,
) {
	return () => {
		let { id, min, max, step, value, defaultValue, mix, ...rest } = handle.props;
		let context = handle.context.get(ColorArea);
		let resolvedStep = step ?? DEFAULT_STEP;
		let resolvedValue = value ?? defaultValue ?? context.saturation;

		warnIfNoAccessibleLabel(
			handle.props,
			"ColorArea.SaturationThumb: this thumb needs an `aria-label` describing the saturation axis — assistive technology has no accessible name for it otherwise.",
		);

		return (
			<input
				{...rest}
				type="range"
				id={id ?? context.saturationThumbId}
				min={min ?? DEFAULT_MIN}
				max={max ?? DEFAULT_MAX}
				step={resolvedStep}
				defaultValue={resolvedValue}
				mix={[
					absolute(),
					z(10),
					is("full"),
					bs("full"),

					when("&::-webkit-slider-thumb", [
						rounded("full"),
						border({ width: 2, color: "neutral.tint" }),
						bg("neutral.tint"),
						cursor("pointer"),
						transition("scale"),
					]),
					when("&::-moz-range-thumb", [
						rounded("full"),
						border({ width: 2, color: "neutral.tint" }),
						bg("neutral.tint"),
						cursor("pointer"),
						transition("scale"),
					]),
					when(
						"&:focus-visible::-webkit-slider-thumb",
						outline({ color: "brand.ring", offset: 2 }),
					),
					when("&:focus-visible::-moz-range-thumb", outline({ color: "brand.ring", offset: 2 })),
					when("&:disabled::-webkit-slider-thumb", [cursor("not-allowed"), opacity(50)]),
					when("&:disabled::-moz-range-thumb", [cursor("not-allowed"), opacity(50)]),

					inset("0"),
					m("0"),
					bg("transparent"),
					appearance("none", { moz: false }),
					raw({ direction: "ltr" }),
					pointerEvents(),
					outlineStyle("none"),

					when("&::-webkit-slider-runnable-track", [
						is("full"),
						bs("full"),
						bg("transparent"),
						appearance("none", { moz: false }),
					]),
					when("&::-moz-range-track", [
						is("full"),
						bs("full"),
						bg("transparent"),
						appearance("none", { webkit: false, moz: false }),
						border({ style: "none" }),
					]),

					when("&::-webkit-slider-thumb", [
						is("var(--ui-color-area-thumb-thickness, 0.1875rem)"),
						bs("var(--ui-color-area-size, 16rem)"),
						appearance("none", { moz: false }),
						pointerEvents("auto"),
						ringShadow("rgb(0 0 0 / 0.4)", 1),
					]),
					when("&::-moz-range-thumb", [
						is("var(--ui-color-area-thumb-thickness, 0.1875rem)"),
						bs("var(--ui-color-area-size, 16rem)"),
						pointerEvents("auto"),
						ringShadow("rgb(0 0 0 / 0.4)", 1),
					]),

					when("&:active::-webkit-slider-thumb", scaleProperty(1.2)),
					when("&:active::-moz-range-thumb", scaleProperty(1.2)),

					media("(prefers-reduced-motion: reduce)", [
						when("&::-webkit-slider-thumb", transitionDuration("0s")),
						when("&::-moz-range-thumb", transitionDuration("0s")),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * `writing-mode`/`direction` stay fixed regardless of the page's own `dir`,
 * so this line travels block-end (black) to block-start, the low-at-the-
 * bottom convention; pointer layering matches {@link ColorArea.SaturationThumb}.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the thumb's markup.
 * @example
 * <ColorArea.ValueThumb aria-label={t("colorPicker.brightness")} />
 */
ColorArea.ValueThumb = function ColorAreaValueThumb(handle: Handle<ColorArea.ValueThumbProps>) {
	return () => {
		let { id, min, max, step, value, defaultValue, mix, ...rest } = handle.props;
		let context = handle.context.get(ColorArea);
		let resolvedStep = step ?? DEFAULT_STEP;
		let resolvedValue = value ?? defaultValue ?? context.value;

		warnIfNoAccessibleLabel(
			handle.props,
			"ColorArea.ValueThumb: this thumb needs an `aria-label` describing the brightness axis — assistive technology has no accessible name for it otherwise.",
		);

		return (
			<input
				{...rest}
				type="range"
				id={id ?? context.valueThumbId}
				min={min ?? DEFAULT_MIN}
				max={max ?? DEFAULT_MAX}
				step={resolvedStep}
				defaultValue={resolvedValue}
				aria-orientation="vertical"
				mix={[
					absolute(),
					z(10),
					is("full"),
					bs("full"),

					when("&::-webkit-slider-thumb", [
						rounded("full"),
						border({ width: 2, color: "neutral.tint" }),
						bg("neutral.tint"),
						cursor("pointer"),
						transition("scale"),
					]),
					when("&::-moz-range-thumb", [
						rounded("full"),
						border({ width: 2, color: "neutral.tint" }),
						bg("neutral.tint"),
						cursor("pointer"),
						transition("scale"),
					]),
					when(
						"&:focus-visible::-webkit-slider-thumb",
						outline({ color: "brand.ring", offset: 2 }),
					),
					when("&:focus-visible::-moz-range-thumb", outline({ color: "brand.ring", offset: 2 })),
					when("&:disabled::-webkit-slider-thumb", [cursor("not-allowed"), opacity(50)]),
					when("&:disabled::-moz-range-thumb", [cursor("not-allowed"), opacity(50)]),

					inset("0"),
					m("0"),
					bg("transparent"),
					appearance("none", { moz: false }),
					raw({ writingMode: "vertical-lr", direction: "rtl" }),
					pointerEvents(),
					outlineStyle("none"),

					when("&::-webkit-slider-runnable-track", [
						is("full"),
						bs("full"),
						bg("transparent"),
						appearance("none", { moz: false }),
					]),
					when("&::-moz-range-track", [
						is("full"),
						bs("full"),
						bg("transparent"),
						appearance("none", { webkit: false, moz: false }),
						border({ style: "none" }),
					]),

					when("&::-webkit-slider-thumb", [
						is("var(--ui-color-area-thumb-thickness, 0.1875rem)"),
						bs("var(--ui-color-area-size, 16rem)"),
						appearance("none", { moz: false }),
						pointerEvents("auto"),
						ringShadow("rgb(0 0 0 / 0.4)", 1),
					]),
					when("&::-moz-range-thumb", [
						is("var(--ui-color-area-thumb-thickness, 0.1875rem)"),
						bs("var(--ui-color-area-size, 16rem)"),
						pointerEvents("auto"),
						ringShadow("rgb(0 0 0 / 0.4)", 1),
					]),

					when("&:active::-webkit-slider-thumb", scaleProperty(1.2)),
					when("&:active::-moz-range-thumb", scaleProperty(1.2)),

					media("(prefers-reduced-motion: reduce)", [
						when("&::-webkit-slider-thumb", transitionDuration("0s")),
						when("&::-moz-range-thumb", transitionDuration("0s")),
					]),
					mix,
				]}
			/>
		);
	};
};

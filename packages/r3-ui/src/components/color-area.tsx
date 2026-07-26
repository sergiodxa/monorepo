/**
 * A two-dimensional saturation/brightness picking square for a given hue,
 * built from two native `<input type="range">` elements absolutely overlaid
 * on the same rectangle — one plain and horizontal for the saturation axis,
 * one rotated vertical for the brightness axis, exactly the way a vertical
 * orientation is achieved elsewhere in this catalog. Each axis input paints
 * its own native thumb as a thin line spanning the full length of the
 * opposite axis; where the horizontal input's vertical line and the vertical
 * input's horizontal line cross is the picked point, so the two native
 * thumbs together already form the two-dimensional indicator with no further
 * decorative element layered on top.
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
 * {@link DEFAULT_SATURATION} so the default picked point starts at the
 * pure-hue corner of the square.
 */
const DEFAULT_VALUE = 100;

/**
 * `role="group"` applied through {@link attrs} unless a consumer supplies
 * its own `role`, announcing the root as a single grouped control to
 * assistive technology even though its two axes ride two separate native
 * inputs.
 */
const DEFAULT_ROLE = "group";

/**
 * Prop types for {@link ColorArea} and its compound parts.
 */
export namespace ColorArea {
	/**
	 * Value {@link ColorArea} stores in component context so its
	 * {@link ColorArea.SaturationThumb} and {@link ColorArea.ValueThumb}
	 * nested inside share the same resolved hue, current position, and a
	 * pair of stable ids without a consumer repeating them on each part.
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
		 * Hue, in degrees `0`–`360`, the square's background renders every
		 * reachable saturation/brightness combination for. Defaults to
		 * {@link DEFAULT_HUE}. Typically driven by whatever hue control sits
		 * alongside this one, re-rendering this square each time hue changes.
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
	 * Every native `<input>` attribute except `type` and `role`, which the
	 * host fixes to `"range"` and the platform's own implicit `"slider"` role
	 * respectively, plus the `mix` passthrough. Use `value`/`defaultValue` to
	 * override the saturation this thumb starts at, `min`/`max`/`step` to
	 * change its precision, `disabled` to disable it, `name` for form
	 * submission, and `aria-label`/`aria-labelledby` for its accessible name.
	 */
	export interface SaturationThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}

	/**
	 * Every native `<input>` attribute except `type` and `role`, which the
	 * host fixes to `"range"` and the platform's own implicit `"slider"` role
	 * respectively, plus the `mix` passthrough. Use `value`/`defaultValue` to
	 * override the brightness this thumb starts at, `min`/`max`/`step` to
	 * change its precision, `disabled` to disable it, `name` for form
	 * submission, and `aria-label`/`aria-labelledby` for its accessible name.
	 */
	export interface ValueThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}
}

/**
 * Renders the root host: a `position: relative` `<div>` sized to a square
 * through the `--ui-color-area-size` custom property, painting the full
 * range of saturation/brightness combinations reachable at the resolved hue
 * as its own background. The background stacks a brightness gradient
 * (opaque black fading to transparent from the block-end edge toward the
 * block-start edge) over a saturation gradient (opaque white fading to
 * transparent from the inline-start edge toward the inline-end edge) over a
 * solid fill of the pure hue — literal black and white here are the fixed
 * primaries the brightness/saturation math itself is defined against, not a
 * themed choice, so they stay literal rather than reading from a `--ui-*`
 * variable. Resolves the current hue, saturation, and brightness, plus a
 * pair of stable ids, into component context, so a nested
 * {@link ColorArea.SaturationThumb} and {@link ColorArea.ValueThumb} read
 * the same numbers without a consumer repeating them.
 *
 * In dev mode, a root with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name for the group its two axis inputs are announced under.
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
		let resolvedStyle =
			typeof style === "string"
				? `${style};--ui-color-area-hue:${resolvedHue}`
				: { ...style, "--ui-color-area-hue": resolvedHue };

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
					// Black/white here are the fixed brightness/saturation primaries
					// the picking math is defined against, not a themed surface
					// color — see the doc comment above.
					bg({
						image: `${linearGradient("to top", "black", "transparent")}, ${linearGradient("to right", "white", "transparent")}`,
					}),
					// The hue itself is a computed `hsl()` value read off a custom
					// property — `bg()`'s token resolver now passes through any value
					// containing "(" unchanged, so this composes directly instead of
					// needing `raw()`.
					bg("hsl(var(--ui-color-area-hue, 0) 100% 50%)"),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the saturation (x-axis) thumb: a native `<input type="range">`
 * reset to cover its enclosing {@link ColorArea}'s entire box, plain and
 * horizontal so its value travels from the inline-start edge (fully
 * desaturated) toward the inline-end edge (fully saturated at the resolved
 * hue). Its own runnable track stays fully transparent and inert — the root
 * already paints the visible square — and only its own native thumb paints,
 * reshaped into a thin line spanning the full block size of the square so it
 * reads as a vertical position marker rather than a small dot. That line's
 * `direction` is fixed to left-to-right regardless of the surrounding page's
 * own `dir`, so its travel always matches the root's background gradient,
 * whose axes are painted in physical directions no CSS gradient can express
 * logically.
 *
 * The thumb line itself is the only part of this input left interactive —
 * everywhere else on the input has pointer interaction turned off — so a
 * pointer starting anywhere else in the square instead reaches whichever
 * other part sits beneath it, most often {@link ColorArea.ValueThumb}'s own
 * line. Both thumbs stay reachable by keyboard regardless: tabbing between
 * them and pressing an arrow key adjusts that thumb's own axis by one step.
 *
 * In dev mode, a thumb with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name for this axis.
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
						outline({ color: "primary.ring", offset: 2 }),
					),
					when("&:focus-visible::-moz-range-thumb", outline({ color: "primary.ring", offset: 2 })),
					when("&:disabled::-webkit-slider-thumb", [cursor("not-allowed"), opacity(50)]),
					when("&:disabled::-moz-range-thumb", [cursor("not-allowed"), opacity(50)]),

					inset("0"),
					m("0"),
					bg("transparent"),
					// Host-level native chrome reset, narrowed to the standard and
					// WebKit-prefixed properties only — Firefox's own range input
					// needs a real (not inert) `MozAppearance: "none"` reset instead,
					// applied per-pseudo-element below, so this host-level reset
					// disables the Firefox mirror. `direction` has no matching
					// utility at all.
					appearance("none", { moz: false }),
					raw({ direction: "ltr" }),
					pointerEvents(),
					outlineStyle("none"),

					// Runnable track: fully transparent and inert, sized to the square.
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

					// The native thumb itself, reshaped into a thin line spanning the
					// square via a literal size — pointer-events/box-shadow compose
					// through `pointerEvents()`/`ringShadow()`.
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
 * Renders the brightness (y-axis) thumb: a native `<input type="range">`
 * reset to cover its enclosing {@link ColorArea}'s entire box, rotated
 * vertical through `writing-mode` exactly the way a vertical orientation is
 * achieved elsewhere in this catalog, so its value travels from the
 * block-end edge (black) toward the block-start edge (full brightness at the
 * resolved hue) — a typical picking square's low-at-the-bottom convention.
 * Its own runnable track stays fully transparent and inert — the root
 * already paints the visible square — and only its own native thumb paints,
 * reshaped into a thin line spanning the full inline size of the square so
 * it reads as a horizontal position marker rather than a small dot. Where
 * that line crosses {@link ColorArea.SaturationThumb}'s own line is the
 * picked point, the two native thumbs' lines together already forming this
 * control's two-dimensional indicator.
 *
 * The thumb line itself is the only part of this input left interactive —
 * everywhere else on the input has pointer interaction turned off — so a
 * pointer starting anywhere else in the square instead reaches whichever
 * other part sits beneath it, most often {@link ColorArea.SaturationThumb}'s
 * own line. Both thumbs stay reachable by keyboard regardless: tabbing
 * between them and pressing an arrow key adjusts that thumb's own axis by
 * one step.
 *
 * In dev mode, a thumb with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name for this axis.
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
						outline({ color: "primary.ring", offset: 2 }),
					),
					when("&:focus-visible::-moz-range-thumb", outline({ color: "primary.ring", offset: 2 })),
					when("&:disabled::-webkit-slider-thumb", [cursor("not-allowed"), opacity(50)]),
					when("&:disabled::-moz-range-thumb", [cursor("not-allowed"), opacity(50)]),

					inset("0"),
					m("0"),
					bg("transparent"),
					// Host-level native chrome reset, narrowed to the standard and
					// WebKit-prefixed properties only — see the matching comment in
					// {@link ColorArea.SaturationThumb}. `writingMode`/`direction`
					// have no matching utility.
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

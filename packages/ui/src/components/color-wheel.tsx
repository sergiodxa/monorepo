/**
 * A circular hue picker. Hue's natural domain is an angle swept around a
 * circle, so the pointer math is polar: a center point and an angle in, a
 * hue out. A single native `<input type="range">` carries every value this
 * control reports; `colorWheelDrag()` reshapes the root into a ring when a
 * consumer attaches it through the root's `mix` prop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, outline, outlineStyle } from "@pkg/u/color";
import { mask, opacity, rounded, shadow, transition, transitionDuration } from "@pkg/u/effects";
import { cursor, pointerEvents, pseudoContent, raw } from "@pkg/u/general";
import {
	absolute,
	appearance,
	block,
	inlineBlock,
	insBs,
	insIs,
	inset,
	relative,
} from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, is, m, mbs, minIs, mis } from "@pkg/u/size";
import { when } from "@pkg/u/state";

import { rangeThumbAppearance } from "../styles/range-thumb-appearance";
import { rtlAwareGradientDirection } from "../styles/rtl-aware-gradient-direction";
import { clampChannel, roundChannel } from "../utils/color-math";
import { HUE_GRADIENT_STOPS } from "../utils/hue-spectrum";
import { mergeStyle } from "../utils/merge-style";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/** Lower bound of {@link ColorWheel}'s fixed hue domain, in degrees — fixed, since the full domain is what makes this control a hue wheel. */
const DEFAULT_MIN = 0;

/** Upper bound of {@link ColorWheel}'s fixed hue domain, in degrees; reaching it wraps back to the same red {@link DEFAULT_MIN} starts from, since hue is continuous around the circle. */
const DEFAULT_MAX = 360;

/** Degrees a single keypress moves {@link ColorWheel}'s value by, applied when `step` is omitted. */
const DEFAULT_STEP = 1;

/** Hue, in degrees, {@link ColorWheel} falls back to when both `value` and `defaultValue` are omitted. */
const DEFAULT_VALUE = 0;

/**
 * Custom property naming the plain-bar track gradient's sweep direction,
 * flipped from `"right"` to `"left"` under `:dir(rtl)` so the gradient
 * always reads in the same direction as the surrounding text.
 */
const TRACK_DIRECTION_PROPERTY = "--ui-color-wheel-track-direction";

/**
 * The plain-bar track background, sweeping {@link HUE_GRADIENT_STOPS}
 * toward {@link TRACK_DIRECTION_PROPERTY}'s current direction — shared
 * verbatim between the WebKit and Gecko track pseudo-elements.
 */
const HUE_TRACK_GRADIENT = `linear-gradient(to var(${TRACK_DIRECTION_PROPERTY}, right), ${HUE_GRADIENT_STOPS})`;

/**
 * The ring rendering's background: {@link HUE_GRADIENT_STOPS} swept
 * clockwise from twelve o'clock, matching the convention the ring's own
 * drag math measures angles by, so painted position always matches value.
 */
const WHEEL_CONIC_GRADIENT = `conic-gradient(from 0deg, ${HUE_GRADIENT_STOPS})`;

/**
 * An alpha mask cutting the ring's filled disc down to a
 * `--ui-color-wheel-thumb-size` band at the outer edge, the same width the
 * plain bar's track and thumb share, so only a ring remains visible.
 */
const RING_MASK =
	"radial-gradient(circle, transparent calc(50% - var(--ui-color-wheel-thumb-size, 1.25rem)), black calc(50% - var(--ui-color-wheel-thumb-size, 1.25rem) + 1px))";

/**
 * Prop types for {@link ColorWheel}.
 */
export namespace ColorWheel {
	/**
	 * Per-part styling for the underlying native hue control this convenience
	 * wrapper composes alongside its own host `<div>`.
	 */
	export interface PartsProps {
		/** Styling for the native `<input type="range">` reporting the current hue. */
		input?: TagProps<"input">["mix"];
	}

	/**
	 * Props accepted by {@link ColorWheel}. `mix` styles the root element that
	 * the plain-bar or ring rendering paints itself on; style the nested hue
	 * input individually through `parts` instead.
	 */
	export interface Props extends Omit<TagProps<"div">, "children"> {
		/** Current hue, in degrees `0`–`360`, for a wheel a consumer tracks itself. */
		value?: number;
		/** Starting hue, in degrees `0`–`360`, for a wheel left to the platform's own uncontrolled state. */
		defaultValue?: number;
		/** Degrees a single keypress moves the value by. Defaults to {@link DEFAULT_STEP}. */
		step?: number;
		/** Native `name` submitted with an enclosing form. */
		name?: string;
		/** Native `id` of the form the underlying hue input associates with, when it sits outside that form's own markup. */
		form?: string;
		/** Marks the underlying hue input inert and excluded from the tab order. */
		disabled?: boolean;
		/** Per-part styling for this wrapper's internally composed hue input. */
		parts?: PartsProps;
	}
}

/**
 * Renders a root `<div>` around a single `<input type="range">` across
 * hue's `0`–`360` domain, carrying every accessibility and form semantic
 * this wheel exposes; `colorWheelDrag()` enables the ring rendering.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the wheel's markup.
 * @example
 * <ColorWheel aria-label={t("colorPicker.hue")} defaultValue={210} />
 * @example
 * <ColorWheel aria-label={t("theme.accentHue")} value={hue} name="hue" disabled={isLocked} />
 */
export function ColorWheel(handle: Handle<ColorWheel.Props>) {
	return () => {
		let {
			value,
			defaultValue,
			step,
			name,
			disabled,
			form,
			"aria-label": ariaLabel,
			"aria-labelledby": ariaLabelledby,
			"aria-describedby": ariaDescribedby,
			parts,
			style,
			mix,
			...rest
		} = handle.props;
		let resolvedValue = value ?? defaultValue ?? DEFAULT_VALUE;
		let resolvedStep = step ?? DEFAULT_STEP;
		let resolvedHue = roundChannel(clampChannel(resolvedValue, DEFAULT_MIN, DEFAULT_MAX));
		let resolvedStyle = mergeStyle(style, {
			"--ui-color-wheel-value": `hsl(${resolvedHue} 100% 50%)`,
			"--ui-color-wheel-hue": `${resolvedHue}`,
		});

		warnIfNoAccessibleLabel(
			handle.props,
			"ColorWheel: a wheel with no `aria-label` or `aria-labelledby` needs one describing the hue it picks — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<div
				{...rest}
				data-slot="color-wheel"
				style={resolvedStyle}
				mix={[
					relative(),
					block(),
					is("full"),
					minIs("10rem"),
					when(
						'&[data-shape="circular"]',
						when("&:has(> input:focus-visible)", outline({ color: "brand.ring", offset: 2 })),
					),
					when('&[data-shape="circular"]', [
						inlineBlock(),
						is("var(--ui-color-wheel-size, 12rem)"),
						bs("var(--ui-color-wheel-size, 12rem)"),
						minIs("0"),
						rounded("full"),
						bg({ image: WHEEL_CONIC_GRADIENT }),
						mask(RING_MASK),

						when("&::after", [
							absolute(),
							is("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							bs("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							mbs("calc(var(--ui-color-wheel-thumb-size, 1.25rem) / -2)"),
							mis("calc(var(--ui-color-wheel-thumb-size, 1.25rem) / -2)"),
							rounded("full"),
							border({
								width: "var(--ui-color-wheel-thumb-border-width, 2px)",
								style: "solid",
								color: "var(--ui-color-wheel-value, var(--ui-brand-bg-solid))",
							}),
							bg("neutral.tint"),
							transition("transform"),
							insBs("50%"),
							insIs("50%"),
							shadow("base"),
							pointerEvents(),
							pseudoContent('""'),
							raw({
								transform:
									"rotate(calc(var(--ui-color-wheel-hue, 0) * 1deg)) translateY(calc(var(--ui-color-wheel-size, 12rem) / -2 + var(--ui-color-wheel-thumb-size, 1.25rem) / 2))",
							}),
						]),

						when("&:has(> input:disabled)", [
							opacity(50),
							when("&::after", [border("neutral"), raw({ boxShadow: "none" })]),
						]),

						when("& > input", [absolute(), inset("0"), is("full"), bs("full"), opacity(0)]),

						media("(prefers-reduced-motion: reduce)", when("&::after", transitionDuration("0s"))),
					]),
					mix,
				]}
			>
				<input
					type="range"
					min={DEFAULT_MIN}
					max={DEFAULT_MAX}
					step={resolvedStep}
					defaultValue={resolvedValue}
					name={name}
					disabled={disabled}
					form={form}
					aria-label={ariaLabel}
					aria-labelledby={ariaLabelledby}
					aria-describedby={ariaDescribedby}
					data-slot="input"
					mix={[
						rtlAwareGradientDirection(TRACK_DIRECTION_PROPERTY),
						rangeThumbAppearance(
							"--ui-color-wheel-thumb-size",
							"--ui-color-wheel-thumb-border-width",
						),
						block(),
						is("full"),
						cursor("pointer"),
						when("&:disabled", cursor("not-allowed")),
						bs("var(--ui-color-wheel-thumb-size, 1.25rem)"),
						m("0"),
						bg("transparent"),
						appearance("none", { moz: false }),
						outlineStyle("none"),

						when("&::-webkit-slider-runnable-track", [
							bs("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							rounded("full"),
							bg({ image: HUE_TRACK_GRADIENT }),
							appearance("none", { moz: false }),
						]),
						when("&::-moz-range-track", [
							bs("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							rounded("full"),
							bg({ image: HUE_TRACK_GRADIENT }),
							border({ style: "none" }),
							appearance("none", { webkit: false, moz: false }),
						]),

						when('[data-shape="circular"] &', [
							cursor("pointer"),
							appearance("none", { moz: false }),

							when("&::-webkit-slider-runnable-track", bg({ image: "none", color: "transparent" })),
							when("&::-moz-range-track", bg({ image: "none", color: "transparent" })),
							when("&::-webkit-slider-thumb", [
								border({ style: "none" }),
								bg("transparent"),
								raw({ boxShadow: "none" }),
							]),
							when("&::-moz-range-thumb", [
								border({ style: "none" }),
								bg("transparent"),
								raw({ boxShadow: "none" }),
							]),
							when(
								"&:focus-visible::-webkit-slider-thumb, &:focus-visible::-moz-range-thumb",
								outlineStyle("none"),
							),
						]),
						parts?.input,
					]}
				/>
			</div>
		);
	};
}

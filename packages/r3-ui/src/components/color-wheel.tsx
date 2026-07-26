/**
 * A circular hue picker. Hue's natural domain is an angle swept around a
 * circle, so the math behind placing and moving a pointer on this control is
 * polar — a center point and an angle in, a hue out — rather than the two
 * independent axes a rectangular picking surface reasons about. Every value
 * this control reports stays reachable through a single native
 * `<input type="range">` nested inside a root that carries no appearance of
 * its own beyond hosting that input: on its own, the input covers the root's
 * full width as a plain bar, its own track painted with the same
 * full-spectrum sweep this component family's linear hue controls paint their
 * own track with, at the same thickness and thumb size. Reshaping the root
 * into a ring, and turning a pointer's angle around that ring's center back
 * into the same value, is `colorWheelDrag()`'s job once a consuming island
 * applies it to the root through its `mix` prop — this component's own
 * styling already carries both the plain-bar rendering and the ring
 * repainting that mixin's own `data-shape="circular"` flag switches on, so
 * attaching it is the only step an island adds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, outline } from "@pkg/u/color";
import { opacity, rounded, transition } from "@pkg/u/effects";
import { cursor, raw } from "@pkg/u/general";
import { absolute, block, inlineBlock, inset, relative } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { bs, is, m, mbs, minIs, mis } from "@pkg/u/size";
import { when } from "@pkg/u/state";

import { rangeThumbAppearance } from "../styles/range-thumb-appearance";
import { rtlAwareGradientDirection } from "../styles/rtl-aware-gradient-direction";
import { clampChannel, roundChannel } from "../utils/color-math";
import { HUE_GRADIENT_STOPS } from "../utils/hue-spectrum";
import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/** Lower bound of {@link ColorWheel}'s fixed hue domain, in degrees. Never overridable — a wheel that picked from anything but the full domain would no longer be a hue wheel. */
const DEFAULT_MIN = 0;

/** Upper bound of {@link ColorWheel}'s fixed hue domain, in degrees. Reaching it lands back on the same red {@link DEFAULT_MIN} starts from, since hue wraps around the circle rather than stopping. */
const DEFAULT_MAX = 360;

/** Degrees a single keypress moves {@link ColorWheel}'s value by, applied when `step` is omitted. */
const DEFAULT_STEP = 1;

/** Hue, in degrees, {@link ColorWheel} falls back to when both `value` and `defaultValue` are omitted. */
const DEFAULT_VALUE = 0;

/**
 * Custom property naming the direction the plain-bar rendering's track
 * gradient sweeps toward, flipped from its `"right"` default to `"left"`
 * under `:dir(rtl)` so the gradient's reading direction always matches the
 * surrounding text direction instead of a fixed physical side. The ring
 * rendering paints from a fixed compass-style orientation instead — a color
 * wheel's spectrum reads the same regardless of surrounding text direction,
 * the same way a clock face or compass would.
 */
const TRACK_DIRECTION_PROPERTY = "--ui-color-wheel-track-direction";

/**
 * The plain-bar rendering's track background, sweeping
 * {@link HUE_GRADIENT_STOPS} toward {@link TRACK_DIRECTION_PROPERTY}'s
 * current direction. Shared verbatim between the WebKit and Gecko track
 * pseudo-elements so both engines paint from the exact same declaration.
 */
const HUE_TRACK_GRADIENT = `linear-gradient(to var(${TRACK_DIRECTION_PROPERTY}, right), ${HUE_GRADIENT_STOPS})`;

/**
 * The ring rendering's background: {@link HUE_GRADIENT_STOPS} swept clockwise
 * from the twelve o'clock position, matching the same clockwise-from-12
 * convention the pointer-angle math behind the ring's own dragging measures
 * by, so a hue's position on the painted ring always agrees with the angle
 * that hue maps to.
 */
const WHEEL_CONIC_GRADIENT = `conic-gradient(from 0deg, ${HUE_GRADIENT_STOPS})`;

/**
 * An alpha mask cutting the ring rendering's filled disc down to a band
 * `--ui-color-wheel-thumb-size` wide at the outer edge —
 * {@link WHEEL_CONIC_GRADIENT} paints through that band alone, the same
 * width the plain bar's own track and thumb already share, and the
 * transparent center it leaves behind keeps the disc's own middle unpainted
 * so only a ring remains visible.
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
 * Renders a root `<div>` wrapping a single `<input type="range">` spanning
 * hue's fixed `0`–`360` degree domain — the one native control carrying every
 * accessibility and form-submission semantic this wheel exposes, and the one
 * element {@link colorWheelDrag}'s mixin queries for beneath the root it
 * attaches to. On its own, the root supplies no appearance beyond hosting
 * that input at its own full width, so the input's own track — painted with
 * the fixed six-stop {@link HUE_GRADIENT_STOPS} sweep through red, yellow,
 * green, cyan, blue, and magenta back to red, identical across every engine
 * and never dependent on the current value, since every point along a hue
 * track already represents a reachable hue on its own — is this control's
 * entire rendered form. The thumb rides a neutral fill bordered in the
 * semantic primary color, sized and shaped identically to this component
 * family's other single-channel controls.
 *
 * The root's own styling also carries the ring rendering `colorWheelDrag()`
 * switches on by setting `data-shape="circular"` on attach: a fixed circular
 * diameter, {@link WHEEL_CONIC_GRADIENT} masked down to a ring band by
 * {@link RING_MASK}, and a small marker riding that ring at the angle a
 * `--ui-color-wheel-hue` custom property resolves to, bordered in the hue it
 * currently marks through a paired `--ui-color-wheel-value` custom property —
 * both set from `value`/`defaultValue` at render time, so the marker already
 * sits at, and reads in, the color it is about to pick before any script
 * runs. The hue input itself stays present underneath — focusable, operable
 * by arrow key, and still posting its value with the form — with its own
 * track and thumb turned fully transparent, so the ring's focus-visible ring
 * and disabled dimming read from the root through a `:has()` query against
 * that same input instead of the input's own now-invisible pseudo-elements.
 *
 * Pressing scales the plain bar's thumb up slightly, a focus-visible ring
 * reads in the primary color, and disabling it mutes the border to the
 * neutral tone and drops its shadow — every one of those transitions
 * collapses to an instant change under reduced motion.
 *
 * In dev mode, a wheel with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible name
 * to announce for it.
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
		let resolvedStyle =
			typeof style === "string"
				? `${style};--ui-color-wheel-value:hsl(${resolvedHue} 100% 50%);--ui-color-wheel-hue:${resolvedHue}`
				: {
						...style,
						"--ui-color-wheel-value": `hsl(${resolvedHue} 100% 50%)`,
						"--ui-color-wheel-hue": `${resolvedHue}`,
					};

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
						when("&:has(> input:focus-visible)", outline({ color: "primary.ring", offset: 2 })),
					),
					when('&[data-shape="circular"]', [
						inlineBlock(),
						is("var(--ui-color-wheel-size, 12rem)"),
						bs("var(--ui-color-wheel-size, 12rem)"),
						minIs("0"),
						rounded("full"),
						bg({ image: WHEEL_CONIC_GRADIENT }),
						raw({ maskImage: RING_MASK, WebkitMaskImage: RING_MASK }),

						when("&::after", [
							absolute(),
							is("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							bs("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							mbs("calc(var(--ui-color-wheel-thumb-size, 1.25rem) / -2)"),
							mis("calc(var(--ui-color-wheel-thumb-size, 1.25rem) / -2)"),
							rounded("full"),
							border({ width: "var(--ui-color-wheel-thumb-border-width, 2px)", style: "solid" }),
							bg("neutral.tint"),
							transition("transform"),
							raw({
								content: '""',
								insetBlockStart: "50%",
								insetInlineStart: "50%",
								borderColor: "var(--ui-color-wheel-value, var(--ui-primary-bg-solid))",
								boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
								pointerEvents: "none",
								transform:
									"rotate(calc(var(--ui-color-wheel-hue, 0) * 1deg)) translateY(calc(var(--ui-color-wheel-size, 12rem) / -2 + var(--ui-color-wheel-thumb-size, 1.25rem) / 2))",
							}),
						]),

						when("&:has(> input:disabled)", [
							opacity(50),
							when("&::after", [border("neutral"), raw({ boxShadow: "none" })]),
						]),

						when("& > input", [absolute(), inset("0"), is("full"), bs("full"), opacity(0)]),

						media(
							"(prefers-reduced-motion: reduce)",
							when("&::after", raw({ transitionDuration: "0s" })),
						),
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
						raw({ WebkitAppearance: "none", appearance: "none", outlineStyle: "none" }),

						when("&::-webkit-slider-runnable-track", [
							bs("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							rounded("full"),
							bg({ image: HUE_TRACK_GRADIENT }),
							raw({ WebkitAppearance: "none", appearance: "none" }),
						]),
						when("&::-moz-range-track", [
							bs("var(--ui-color-wheel-thumb-size, 1.25rem)"),
							rounded("full"),
							bg({ image: HUE_TRACK_GRADIENT }),
							border({ style: "none" }),
							raw({ appearance: "none" }),
						]),

						when('[data-shape="circular"] &', [
							cursor("pointer"),
							raw({ WebkitAppearance: "none", appearance: "none" }),

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
								raw({ outlineStyle: "none" }),
							),
						]),
						parts?.input,
					]}
				/>
			</div>
		);
	};
}

/**
 * A single-channel color control on a native `<input type="range">`, pairing
 * a track painting the channel's gradient with a thumb reporting the current
 * value and an `<output>` for its formatted display. The root shares the
 * resolved channel, range, and value with every part through context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, outlineStyle } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { cursor, pseudoContent } from "@pkg/u/general";
import { absolute, appearance, inset, relative, vstack } from "@pkg/u/layout";
import { bs, is, m, minIs } from "@pkg/u/size";
import { z } from "@pkg/u/stacking";
import { when } from "@pkg/u/state";

import { outputCaptionText } from "../styles/output-caption-text";
import { rangeThumbAppearance } from "../styles/range-thumb-appearance";
import { rtlAwareGradientDirection } from "../styles/rtl-aware-gradient-direction";
import { HUE_GRADIENT_STOPS } from "../utils/hue-spectrum";
import { mergeStyle } from "../utils/merge-style";

/**
 * Custom property carrying a {@link ColorSlider.Track}'s gradient direction,
 * mirrored under `:dir(rtl)` so one gradient string paints correctly in both
 * writing directions.
 */
const TRACK_DIRECTION_PROPERTY = "--ui-color-slider-track-direction";

/**
 * Custom property carrying the color's current hue, in degrees, that a
 * `"saturation"`, `"lightness"`, or `"alpha"` {@link ColorSlider.Track} reads
 * its gradient formula from.
 */
const TRACK_HUE_PROPERTY = "--ui-color-slider-hue";

/** Hue {@link ColorSlider.Track} falls back to when its `hue` prop is omitted. */
const DEFAULT_HUE = 0;

/** Lower bound every {@link ColorSlider.Channel} shares, applied when `min` is omitted. */
const DEFAULT_MIN = 0;

/** Upper bound {@link ColorSlider.Props} falls back to, keyed by {@link ColorSlider.Channel}, when `max` is omitted. */
const DEFAULT_MAX_BY_CHANNEL: Record<ColorSlider.Channel, number> = {
	hue: 360,
	saturation: 100,
	lightness: 100,
	alpha: 1,
};

/** Native `step` {@link ColorSlider.Thumb} falls back to, keyed by {@link ColorSlider.Channel}, when `step` is omitted. */
const DEFAULT_STEP_BY_CHANNEL: Record<ColorSlider.Channel, number> = {
	hue: 1,
	saturation: 1,
	lightness: 1,
	alpha: 0.01,
};

/**
 * Builds one {@link ColorSlider.Track} gradient string from its color stops,
 * reading {@link TRACK_DIRECTION_PROPERTY} for its direction so the same
 * stops mirror correctly under `:dir(rtl)` from one shared gradient string.
 */
function trackGradient(stops: string): string {
	return `linear-gradient(to var(${TRACK_DIRECTION_PROPERTY}, right), ${stops})`;
}

/** The full, fixed rainbow a `"hue"` {@link ColorSlider.Track} always paints. */
const HUE_GRADIENT = trackGradient(HUE_GRADIENT_STOPS);

/** A `"saturation"` {@link ColorSlider.Track}'s gradient: fully desaturated through fully saturated, at {@link TRACK_HUE_PROPERTY}'s hue. */
const SATURATION_GRADIENT = trackGradient(
	`hsl(var(${TRACK_HUE_PROPERTY}, 0) 0% 50%), hsl(var(${TRACK_HUE_PROPERTY}, 0) 100% 50%)`,
);

/** A `"lightness"` {@link ColorSlider.Track}'s gradient: black through {@link TRACK_HUE_PROPERTY}'s hue through white. */
const LIGHTNESS_GRADIENT = trackGradient(
	`black, hsl(var(${TRACK_HUE_PROPERTY}, 0) 100% 50%), white`,
);

/** An `"alpha"` {@link ColorSlider.Track}'s gradient: fully transparent through {@link TRACK_HUE_PROPERTY}'s hue at full opacity, over the track's own checkerboard backdrop. */
const ALPHA_GRADIENT = trackGradient(`transparent, hsl(var(${TRACK_HUE_PROPERTY}, 0) 100% 50%)`);

/**
 * Prop types for {@link ColorSlider} and its compound parts.
 */
export namespace ColorSlider {
	/**
	 * The single color channel one {@link ColorSlider} instance edits. Every
	 * channel but `"hue"` itself also shares its live color through the `hue`
	 * prop its {@link Track} reads.
	 */
	export type Channel = "hue" | "saturation" | "lightness" | "alpha";

	/**
	 * Value {@link ColorSlider} stores in component context so every
	 * {@link ColorSlider.Track} and {@link ColorSlider.Thumb} nested inside
	 * shares the same resolved channel, range, and value.
	 */
	export interface Context {
		/** The channel this instance edits. Mirrored onto the root's own `data-channel` attribute, which {@link ColorSlider.Track} reads to pick its gradient formula. */
		channel: Channel;
		/** Resolved lower bound of the channel's range, shared with {@link ColorSlider.Thumb}. */
		min: number;
		/** Resolved upper bound of the channel's range, shared with {@link ColorSlider.Thumb}. */
		max: number;
		/** Resolved current value, used as {@link ColorSlider.Thumb}'s own default value. */
		value: number;
	}

	/**
	 * Props accepted by {@link ColorSlider}.
	 */
	export interface Props extends TagProps<"div"> {
		/** The single channel this instance edits. */
		channel: Channel;
		/** Lower bound of the channel's range. Defaults to {@link DEFAULT_MIN}. */
		min?: number;
		/** Upper bound of the channel's range. Defaults to `channel`'s entry in {@link DEFAULT_MAX_BY_CHANNEL}. */
		max?: number;
		/** Current value, for an instance whose value the consumer tracks itself. */
		value?: number;
		/** Starting value, for an instance that never tracks its own value. */
		defaultValue?: number;
	}

	/**
	 * Props accepted by {@link ColorSlider.Track}.
	 */
	export interface TrackProps extends TagProps<"div"> {
		/**
		 * The color's current hue, in degrees `0`–`360`, read into
		 * {@link TRACK_HUE_PROPERTY} at render time so a `"saturation"`,
		 * `"lightness"`, or `"alpha"` track's gradient matches it. Defaults to {@link DEFAULT_HUE}.
		 */
		hue?: number;
	}

	/**
	 * Every native `<input>` attribute except `type` and `role`, fixed to
	 * `"range"` and the platform's implicit `"slider"` role, plus the `mix`
	 * passthrough. `min`/`max`/`step` override the range inherited from the nearest ancestor {@link ColorSlider}.
	 */
	export interface ThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}

	/**
	 * Props accepted by {@link ColorSlider.Output}. Associate it with a thumb
	 * by passing the paired {@link ColorSlider.Thumb}'s own `id` explicitly as
	 * `htmlFor`.
	 */
	export interface OutputProps extends TagProps<"output"> {}
}

/**
 * Renders the root host: a `<div>` stacking its children with a small gap,
 * resolving the channel, range, and value into component context and
 * mirroring the channel onto its own `data-channel` attribute.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link ColorSlider.Context}.
 * @returns The render function producing the root's markup.
 * @example
 * <ColorSlider channel="hue" defaultValue={210}>
 * 	<ColorSlider.Output htmlFor="accent-hue-thumb">210°</ColorSlider.Output>
 * 	<ColorSlider.Track>
 * 		<ColorSlider.Thumb id="accent-hue-thumb" aria-label={t("colorPicker.hue")} />
 * 	</ColorSlider.Track>
 * </ColorSlider>
 * @example
 * <ColorSlider channel="alpha" min={0} max={1} defaultValue={1}>
 * 	<ColorSlider.Track hue={210}>
 * 		<ColorSlider.Thumb aria-label={t("colorPicker.alpha")} />
 * 	</ColorSlider.Track>
 * </ColorSlider>
 */
export function ColorSlider(handle: Handle<ColorSlider.Props, ColorSlider.Context>) {
	return () => {
		let { channel, min, max, value, defaultValue, mix, ...rest } = handle.props;
		let resolvedMin = min ?? DEFAULT_MIN;
		let resolvedMax = max ?? DEFAULT_MAX_BY_CHANNEL[channel];
		let resolvedValue = value ?? defaultValue ?? resolvedMin;

		handle.context.set({ channel, min: resolvedMin, max: resolvedMax, value: resolvedValue });

		return (
			<div
				data-channel={channel}
				{...rest}
				mix={[vstack({ gap: 2 }), is("full"), minIs("10rem"), mix]}
			/>
		);
	};
}

/**
 * Renders the visual track: a `position: relative` `<div>` painting its
 * whole length with the gradient the nearest ancestor {@link ColorSlider}'s
 * `data-channel` attribute selects, over a checkerboard backdrop.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the track's markup.
 * @example
 * <ColorSlider.Track>
 * 	<ColorSlider.Thumb aria-label={t("colorPicker.hue")} />
 * </ColorSlider.Track>
 * @example
 * <ColorSlider.Track hue={210}>
 * 	<ColorSlider.Thumb aria-label={t("colorPicker.lightness")} />
 * </ColorSlider.Track>
 */
ColorSlider.Track = function ColorSliderTrack(handle: Handle<ColorSlider.TrackProps>) {
	return () => {
		let { hue, mix, style, ...rest } = handle.props;
		let resolvedHue = hue ?? DEFAULT_HUE;
		let resolvedStyle = mergeStyle(style, { [TRACK_HUE_PROPERTY]: `${resolvedHue}` });

		return (
			<div
				{...rest}
				style={resolvedStyle}
				mix={[
					rtlAwareGradientDirection(TRACK_DIRECTION_PROPERTY),
					relative(),
					is("full"),
					bs("var(--ui-color-slider-thumb-size, 1.25rem)"),
					rounded("full"),
					when("&::before", [
						absolute(),
						inset("0"),
						rounded("inherit"),
						bg({
							image:
								"repeating-conic-gradient(var(--ui-neutral-border) 0% 25%, var(--ui-neutral-bg-tint) 0% 50%)",
							size: "var(--ui-color-slider-checker-size, 0.625rem) var(--ui-color-slider-checker-size, 0.625rem)",
						}),
						pseudoContent('""'),
					]),
					when("&::after", [absolute(), inset("0"), rounded("inherit"), pseudoContent('""')]),

					when('[data-channel="hue"] &::after', bg({ image: HUE_GRADIENT })),
					when('[data-channel="saturation"] &::after', bg({ image: SATURATION_GRADIENT })),
					when('[data-channel="lightness"] &::after', bg({ image: LIGHTNESS_GRADIENT })),
					when('[data-channel="alpha"] &::after', bg({ image: ALPHA_GRADIENT })),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the interactive thumb: a native `<input type="range">` reset to
 * cover its enclosing {@link ColorSlider.Track}'s entire box, so drag,
 * arrow-key, and click-to-jump behavior spans the track's whole length.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the thumb's markup.
 * @example
 * <ColorSlider.Thumb aria-label={t("colorPicker.hue")} />
 * @example
 * <ColorSlider.Thumb aria-label={t("colorPicker.alpha")} disabled />
 */
ColorSlider.Thumb = function ColorSliderThumb(handle: Handle<ColorSlider.ThumbProps>) {
	return () => {
		let { id, min, max, step, value, defaultValue, mix, ...rest } = handle.props;
		let context = handle.context.get(ColorSlider);
		let resolvedStep = step ?? DEFAULT_STEP_BY_CHANNEL[context.channel];
		let resolvedValue = value ?? defaultValue ?? context.value;

		return (
			<input
				{...rest}
				type="range"
				id={id ?? handle.id}
				min={min ?? context.min}
				max={max ?? context.max}
				step={resolvedStep}
				defaultValue={resolvedValue}
				mix={[
					rangeThumbAppearance(
						"--ui-color-slider-thumb-size",
						"--ui-color-slider-thumb-border-width",
					),
					absolute(),
					z(10),
					appearance(),
					cursor("pointer"),
					when("&:disabled", cursor("not-allowed")),
					inset("0"),
					m("0"),
					bg("transparent"),
					outlineStyle("none"),

					when("&::-webkit-slider-runnable-track", [
						bs("full"),
						bg("transparent"),
						appearance("none", { moz: false }),
					]),
					when("&::-moz-range-track", [
						bs("full"),
						bg("transparent"),
						border({ style: "none" }),
						appearance("none", { webkit: false, moz: false }),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a live readout: a native `<output>` reporting the formatted value
 * passed as `children`. Pass the paired {@link ColorSlider.Thumb}'s own `id`
 * explicitly as `htmlFor` to associate the two.
 *
 * @param handle Runtime handle carrying the host `<output>`'s props.
 * @returns The render function producing the readout's markup.
 * @example
 * <ColorSlider.Output htmlFor="accent-hue-thumb">
 * 	{new Intl.NumberFormat(locale, { style: "unit", unit: "degree" }).format(210)}
 * </ColorSlider.Output>
 */
ColorSlider.Output = function ColorSliderOutput(handle: Handle<ColorSlider.OutputProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <output {...rest} mix={[outputCaptionText(), mix]} />;
	};
};

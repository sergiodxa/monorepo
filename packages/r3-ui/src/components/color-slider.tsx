/**
 * A single-channel color control built on a native `<input type="range">`,
 * pairing a track that paints its whole length as that channel's gradient
 * with a thumb reporting where within it the current value sits, plus an
 * `<output>` for reporting the current value. The root shares the resolved
 * channel, range, and value with every part through component context, so a
 * track's own gradient formula and a thumb's native attributes always agree
 * without a consumer repeating the same numbers twice.
 *
 * A `"hue"` track paints a fixed rainbow spanning the whole wheel,
 * independent of anything else. A `"saturation"`, `"lightness"`, or
 * `"alpha"` track instead reads the color's current hue from a custom
 * property its own `hue` prop sets at render time, so its gradient always
 * previews convincingly against whatever hue the rest of a composed color
 * picker currently holds — accurate on first paint and every server
 * round-trip, cheap enough to recompute on every render with no dedicated
 * mixin keeping it live between them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import { outputCaptionText } from "../styles/output-caption-text";
import { rangeThumbAppearance } from "../styles/range-thumb-appearance";
import { rtlAwareGradientDirection } from "../styles/rtl-aware-gradient-direction";
import { HUE_GRADIENT_STOPS } from "../utils/hue-spectrum";

/**
 * Custom property carrying a {@link ColorSlider.Track}'s gradient direction,
 * mirrored under `:dir(rtl)` so the same gradient string paints correctly in
 * both writing directions instead of needing a second, mirrored gradient.
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
 * stops mirror correctly under `:dir(rtl)` with no second, mirrored gradient.
 */
function trackGradient(stops: string): string {
	return `linear-gradient(to var(${TRACK_DIRECTION_PROPERTY}, right), ${stops})`;
}

/** The full rainbow a `"hue"` {@link ColorSlider.Track} always paints, independent of any sibling channel's value. */
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
	 * The single color channel one {@link ColorSlider} instance edits. A
	 * composed color picker renders one instance per channel, every instance
	 * sharing the same live color through its own `value` and, for every
	 * channel but `"hue"` itself, through the `hue` prop its {@link Track}
	 * reads.
	 */
	export type Channel = "hue" | "saturation" | "lightness" | "alpha";

	/**
	 * Value {@link ColorSlider} stores in component context so every
	 * {@link ColorSlider.Track} and {@link ColorSlider.Thumb} nested inside
	 * shares the same resolved channel, range, and value without a consumer
	 * repeating them on each part.
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
		 * `"lightness"`, or `"alpha"` track's gradient reflects the hue the rest
		 * of a composed color picker currently holds. A `"hue"` track's own
		 * gradient is a fixed rule spanning the whole wheel and never reads this
		 * prop. Defaults to {@link DEFAULT_HUE} when omitted.
		 */
		hue?: number;
	}

	/**
	 * Every native `<input>` attribute except `type` and `role`, which the host
	 * fixes to `"range"` and the platform's own implicit `"slider"` role
	 * respectively, plus the `mix` passthrough. Use `value`/`defaultValue` for
	 * the thumb's position, `min`/`max`/`step` to override the range inherited
	 * from the nearest ancestor {@link ColorSlider}, `disabled` to disable it,
	 * `name` for form submission, and `aria-label`/`aria-labelledby` for its
	 * accessible name.
	 */
	export interface ThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}

	/**
	 * Props accepted by {@link ColorSlider.Output}. Component context shares
	 * this instance's resolved channel, range, and value, but carries no
	 * shared thumb id, so pass the paired {@link ColorSlider.Thumb}'s own `id`
	 * explicitly as `htmlFor` to associate the two.
	 */
	export interface OutputProps extends TagProps<"output"> {}
}

/**
 * Renders the root host: a `<div>` stacking its children with a small gap,
 * growing to fill the inline axis. Resolves the channel, range, and current
 * value into component context, and mirrors the channel onto its own
 * `data-channel` attribute, so every {@link ColorSlider.Track} nested inside
 * — at any depth — picks its gradient formula through a plain ancestor CSS
 * selector, with no script involved.
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
				mix={[
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.5rem",
						inlineSize: "100%",
						minInlineSize: "10rem",
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the visual track: a `position: relative` `<div>` painting its
 * whole length with the gradient formula the nearest ancestor
 * {@link ColorSlider}'s `data-channel` attribute selects. A `"hue"` track
 * paints a fixed rainbow; a `"saturation"`, `"lightness"`, or `"alpha"` track
 * instead reads `hue` (defaulting to {@link DEFAULT_HUE}) into
 * {@link TRACK_HUE_PROPERTY} at render time, so its own gradient previews
 * convincingly against whatever hue a composed color picker's own `"hue"`
 * instance currently holds. A checkerboard backdrop sits beneath every
 * gradient, painted the same repeating-conic-gradient technique a color
 * preview's own checkerboard uses, so an `"alpha"` track's transparent end
 * always reads correctly regardless of whatever sits behind the page. Nest a
 * single {@link ColorSlider.Thumb} inside — its native
 * `<input type="range">` overlays this track's full box, so the platform's
 * own drag, keyboard, and click-to-jump behavior works across the whole
 * visual length, not just over the thumb's own circle.
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
		let resolvedStyle =
			typeof style === "string"
				? `${style};${TRACK_HUE_PROPERTY}:${resolvedHue}`
				: { ...style, [TRACK_HUE_PROPERTY]: `${resolvedHue}` };

		return (
			<div
				{...rest}
				style={resolvedStyle}
				mix={[
					rtlAwareGradientDirection(TRACK_DIRECTION_PROPERTY),
					css({
						position: "relative",
						inlineSize: "100%",
						blockSize: "var(--ui-color-slider-thumb-size, 1.25rem)",
						borderRadius: "var(--ui-radius-full, 9999px)",

						"&::before": {
							content: '""',
							position: "absolute",
							inset: "0",
							borderRadius: "inherit",
							backgroundImage:
								"repeating-conic-gradient(var(--ui-neutral-border) 0% 25%, var(--ui-neutral-bg-tint) 0% 50%)",
							backgroundSize:
								"var(--ui-color-slider-checker-size, 0.625rem) var(--ui-color-slider-checker-size, 0.625rem)",
						},
						"&::after": {
							content: '""',
							position: "absolute",
							inset: "0",
							borderRadius: "inherit",
						},

						'[data-channel="hue"] &::after': { backgroundImage: HUE_GRADIENT },
						'[data-channel="saturation"] &::after': { backgroundImage: SATURATION_GRADIENT },
						'[data-channel="lightness"] &::after': { backgroundImage: LIGHTNESS_GRADIENT },
						'[data-channel="alpha"] &::after': { backgroundImage: ALPHA_GRADIENT },
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the interactive thumb: a native `<input type="range">` reset to
 * cover its enclosing {@link ColorSlider.Track}'s entire box, so the
 * platform's own drag, arrow-key, and click-to-jump behavior spans the
 * track's whole visual length. Its own runnable track stays transparent —
 * {@link ColorSlider.Track}'s gradient already draws the visible groove — and
 * only its circular thumb pseudo-element paints, sized and colored from
 * `--ui-*` custom properties so it reads consistently across engines. Pairs
 * `min`/`max`/`value` with the nearest ancestor {@link ColorSlider} through
 * context by default, and `step` with that same ancestor's channel, so a
 * consumer only overrides them on the thumb itself when a single instance
 * needs its own range.
 *
 * Pressing scales the thumb up slightly, a focus-visible ring reads in the
 * primary color, and disabling it mutes the border and drops its shadow —
 * every one of those transitions collapses to an instant change under
 * reduced motion.
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
					css({
						position: "absolute",
						inset: "0",
						zIndex: 10,
						margin: "0",
						appearance: "none",
						WebkitAppearance: "none",
						backgroundColor: "transparent",
						cursor: "pointer",
						outlineStyle: "none",

						"&::-webkit-slider-runnable-track": {
							WebkitAppearance: "none",
							appearance: "none",
							blockSize: "100%",
							backgroundColor: "transparent",
						},
						"&::-moz-range-track": {
							appearance: "none",
							blockSize: "100%",
							backgroundColor: "transparent",
							borderStyle: "none",
						},

						"&:disabled": {
							cursor: "not-allowed",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a live readout: a native `<output>` reporting the current value as
 * plain text. Carries no copy of its own — pass the formatted value as
 * `children` — and no default `htmlFor`, since component context shares this
 * instance's resolved channel, range, and value, but not a thumb id to link
 * to; pass the paired {@link ColorSlider.Thumb}'s own `id` explicitly as
 * `htmlFor` to associate the two.
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

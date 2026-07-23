/**
 * A single-value range control built on a native `<input type="range">`,
 * paired with a track that draws its own background rail and a live fill
 * bar, plus an `<output>` for reporting the current value. The root shares
 * the resolved range and value with every part through component context,
 * so a track's fill bar and a thumb's native attributes always agree
 * without a consumer repeating the same numbers twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import {
	absolute,
	appearance,
	bg,
	bs,
	inset,
	is,
	items,
	m,
	minBs,
	minIs,
	overflow,
	relative,
	rounded,
	vstack,
	when,
	z,
} from "@pkg/u";
import { css } from "remix/ui";

import { outputCaptionText } from "../styles/output-caption-text";
import { rangeThumbAppearance } from "../styles/range-thumb-appearance";
import { resolveFillPercent } from "../utils/resolve-fill-percent";

/** Default {@link Slider.Props} orientation, applied when `orientation` is omitted. */
const DEFAULT_ORIENTATION: Slider.Orientation = "horizontal";

/** Default {@link Slider.Props} lower bound, applied when `min` is omitted. */
const DEFAULT_MIN = 0;

/** Default {@link Slider.Props} upper bound, applied when `max` is omitted. */
const DEFAULT_MAX = 100;

/** Default {@link Slider.ThumbProps} step, applied when `step` is omitted. */
const DEFAULT_STEP = 1;

/**
 * Prop types for {@link Slider} and its compound parts.
 */
export namespace Slider {
	/**
	 * Axis the track's fill bar and thumb travel along: a full-width row, or
	 * a full-height column.
	 */
	export type Orientation = "horizontal" | "vertical";

	/**
	 * Value {@link Slider} stores in component context so every
	 * {@link Slider.Track}, {@link Slider.Thumb}, and {@link Slider.Output}
	 * nested inside shares the same resolved range, value, orientation, and
	 * thumb id without a consumer repeating them on each part.
	 */
	export interface Context {
		/** Resolved lower bound of the range, shared with {@link Slider.Thumb}. */
		min: number;
		/** Resolved upper bound of the range, shared with {@link Slider.Thumb}. */
		max: number;
		/** Resolved current value, used to compute {@link Slider.Track}'s fill bar and default {@link Slider.Thumb}'s own value. */
		value: number;
		/** Layout axis, read by {@link Slider.Thumb} to set its accessible orientation. */
		orientation: Orientation;
		/**
		 * Id shared by {@link Slider.Thumb} (as its own `id`) and
		 * {@link Slider.Output} (as its `htmlFor`) so the two associate
		 * natively without either needing an explicit id from the consumer.
		 */
		thumbId: string;
	}

	/**
	 * Props accepted by {@link Slider}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
		/** Lower bound of the range. Defaults to {@link DEFAULT_MIN}. */
		min?: number;
		/** Upper bound of the range. Defaults to {@link DEFAULT_MAX}. */
		max?: number;
		/** Current value, for a slider whose value the consumer tracks itself. */
		value?: number;
		/** Starting value, for a slider that never tracks its own value. */
		defaultValue?: number;
	}

	/**
	 * Props accepted by {@link Slider.Track}.
	 */
	export interface TrackProps extends TagProps<"div"> {}

	/**
	 * Every native `<input>` attribute except `type` and `role`, which the
	 * host fixes to `"range"` and the platform's own implicit `"slider"`
	 * role respectively, plus the `mix` passthrough. Use `value`/`defaultValue`
	 * for the thumb's position, `min`/`max`/`step` to override the range
	 * inherited from the nearest ancestor {@link Slider}, `disabled` to
	 * disable it, `name` for form submission, and
	 * `aria-label`/`aria-labelledby` for its accessible name.
	 */
	export interface ThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}

	/**
	 * Props accepted by {@link Slider.Output}.
	 */
	export interface OutputProps extends TagProps<"output"> {}
}

/**
 * Renders the root host: a `<div>` stacking its children with a small gap,
 * growing to fill the inline axis by default or a fixed block axis when
 * `orientation` is `"vertical"`. Resolves the range, current value,
 * orientation, and a shared thumb id into component context, so every
 * {@link Slider.Track}, {@link Slider.Thumb}, and {@link Slider.Output}
 * nested inside — at any depth — reads the same numbers without a consumer
 * repeating them.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props and providing {@link Slider.Context}.
 * @returns The render function producing the root's markup.
 * @example
 * <Slider aria-label={t("settings.volume")} min={0} max={100} defaultValue={40}>
 * 	<Slider.Output />
 * 	<Slider.Track>
 * 		<Slider.Thumb />
 * 	</Slider.Track>
 * </Slider>
 * @example
 * <Slider orientation="vertical" min={0} max={10} defaultValue={6}>
 * 	<Slider.Track>
 * 		<Slider.Thumb aria-label={t("equalizer.band", { hz: 250 })} />
 * 	</Slider.Track>
 * </Slider>
 */
export function Slider(handle: Handle<Slider.Props, Slider.Context>) {
	return () => {
		let { orientation, min, max, value, defaultValue, mix, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;
		let resolvedMin = min ?? DEFAULT_MIN;
		let resolvedMax = max ?? DEFAULT_MAX;
		let resolvedValue = value ?? defaultValue ?? resolvedMin;

		handle.context.set({
			min: resolvedMin,
			max: resolvedMax,
			value: resolvedValue,
			orientation: resolvedOrientation,
			thumbId: handle.id,
		});

		return (
			<div
				data-orientation={resolvedOrientation}
				{...rest}
				mix={[
					vstack({ gap: "0.5rem" }),
					when('&[data-orientation="horizontal"]', [is("100%"), minIs("10rem")]),
					when('&[data-orientation="vertical"]', [bs("10rem"), items("center")]),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the visual track: a `position: relative` `<div>` sized to the
 * nearest ancestor {@link Slider}'s orientation, drawing a full-length
 * background rail and a colored fill bar as its own `::before`/`::after`
 * pseudo-elements. The fill bar's length is computed from context's
 * resolved `min`/`max`/`value` at render time and carried on the
 * `--ui-slider-fill` custom property. Nest a single {@link Slider.Thumb}
 * inside — its native `<input type="range">` overlays this track's full box
 * so the platform's own drag, keyboard, and click-to-jump behavior works
 * across the whole visual length, not just over the thumb's own circle.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the track's markup.
 * @example
 * <Slider.Track>
 * 	<Slider.Thumb />
 * </Slider.Track>
 */
Slider.Track = function SliderTrack(handle: Handle<Slider.TrackProps>) {
	return () => {
		let { mix, style, ...rest } = handle.props;
		let context = handle.context.get(Slider);
		let fillPercent = resolveFillPercent(context.min, context.max, context.value);
		let resolvedStyle =
			typeof style === "string"
				? `${style};--ui-slider-fill:${fillPercent}%`
				: { ...style, "--ui-slider-fill": `${fillPercent}%` };

		return (
			<div
				{...rest}
				style={resolvedStyle}
				mix={[
					relative(),
					when('[data-orientation="horizontal"] &', [
						is("100%"),
						bs("var(--ui-slider-thumb-size, 1.25rem)"),
					]),
					when('[data-orientation="vertical"] &', [
						is("var(--ui-slider-thumb-size, 1.25rem)"),
						minBs("0"),
						overflow("hidden"),
					]),
					when("&::before", [absolute(), rounded("full"), bg("neutral.border")]),
					when("&::after", [absolute(), rounded("full"), bg("primary.solid")]),
					css({
						'[data-orientation="vertical"] &': {
							flex: "1 1 0%",
						},

						"&::before": {
							content: '""',
						},
						"&::after": {
							content: '""',
						},

						'[data-orientation="horizontal"] &::before': {
							insetInlineStart: "0",
							insetInlineEnd: "0",
							insetBlockStart: "50%",
							blockSize: "var(--ui-slider-track-thickness, 0.5rem)",
							transform: "translateY(-50%)",
						},
						'[data-orientation="horizontal"] &::after': {
							insetInlineStart: "0",
							insetBlockStart: "50%",
							blockSize: "var(--ui-slider-track-thickness, 0.5rem)",
							inlineSize: "var(--ui-slider-fill, 0%)",
							transform: "translateY(-50%)",
						},
						'[data-orientation="vertical"] &::before': {
							insetBlockStart: "0",
							insetInlineStart: "50%",
							inlineSize: "var(--ui-slider-track-thickness, 0.5rem)",
							blockSize: "100%",
							transform: "translateX(-50%)",
						},
						'[data-orientation="vertical"] &::after': {
							insetBlockEnd: "0",
							insetInlineStart: "50%",
							inlineSize: "var(--ui-slider-track-thickness, 0.5rem)",
							blockSize: "var(--ui-slider-fill, 0%)",
							transform: "translateX(-50%)",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the interactive thumb: a native `<input type="range">` reset to
 * cover its enclosing {@link Slider.Track}'s entire box, so the platform's
 * own drag, arrow-key, and click-to-jump behavior spans the track's whole
 * visual length. Its own runnable track stays transparent — {@link
 * Slider.Track}'s rail and fill bar already draw the visible groove — and
 * only its circular thumb pseudo-element paints, sized and colored from
 * `--ui-*` custom properties so it reads consistently across engines. Pairs
 * `min`/`max`/`value` with the nearest ancestor {@link Slider} through
 * context by default, so a consumer only overrides them on the thumb itself
 * when a single instance needs its own range.
 *
 * Pressing scales the thumb up slightly, a focus-visible ring reads in the
 * primary color, and disabling it mutes the border and drops its shadow —
 * every one of those transitions collapses to an instant change under
 * reduced motion. In a `"vertical"` {@link Slider}, the control is rotated
 * with `writing-mode` so its value increases from the block-end edge toward
 * the block-start edge, matching a typical vertical fader's low-at-the-bottom
 * orientation.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the thumb's markup.
 * @example
 * <Slider.Thumb aria-label={t("settings.volume")} />
 * @example
 * <Slider.Thumb aria-label={t("settings.brightness")} disabled />
 */
Slider.Thumb = function SliderThumb(handle: Handle<Slider.ThumbProps>) {
	return () => {
		let { id, min, max, step, value, defaultValue, mix, ...rest } = handle.props;
		let context = handle.context.get(Slider);
		let resolvedStep = step ?? DEFAULT_STEP;
		let resolvedValue = value ?? defaultValue ?? context.value;

		return (
			<input
				{...rest}
				type="range"
				id={id ?? context.thumbId}
				min={min ?? context.min}
				max={max ?? context.max}
				step={resolvedStep}
				defaultValue={resolvedValue}
				aria-orientation={context.orientation === "vertical" ? "vertical" : undefined}
				mix={[
					rangeThumbAppearance("--ui-slider-thumb-size", "--ui-slider-thumb-border-width"),
					absolute(),
					inset("0"),
					z(10),
					m("0"),
					appearance(),
					css({
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

						'[data-orientation="vertical"] &': {
							writingMode: "vertical-lr",
							direction: "rtl",
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a live readout: a native `<output>` associated with the nearest
 * ancestor {@link Slider}'s thumb through `htmlFor` by default, so assistive
 * technology can tell which control this output reports on without the
 * consumer wiring the two ids together by hand. Carries no copy of its
 * own — pass the formatted value as `children`.
 *
 * @param handle Runtime handle carrying the host `<output>`'s props.
 * @returns The render function producing the readout's markup.
 * @example
 * <Slider.Output>{new Intl.NumberFormat(locale, { style: "percent" }).format(0.4)}</Slider.Output>
 */
Slider.Output = function SliderOutput(handle: Handle<Slider.OutputProps>) {
	return () => {
		let { htmlFor, mix, ...rest } = handle.props;
		let context = handle.context.get(Slider);

		return (
			<output {...rest} htmlFor={htmlFor ?? context.thumbId} mix={[outputCaptionText(), mix]} />
		);
	};
};

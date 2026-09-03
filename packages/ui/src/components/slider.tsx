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
	after,
	appearance,
	basis,
	before,
	bg,
	border,
	bs,
	cursor,
	grow,
	insBe,
	insBs,
	insIe,
	insIs,
	inset,
	is,
	items,
	m,
	minBs,
	minIs,
	outlineStyle,
	overflow,
	pseudoContent,
	raw,
	relative,
	rounded,
	shrink,
	translateX,
	translateY,
	vstack,
	when,
	z,
} from "@sdxc/u";

import { outputCaptionText } from "../styles/output-caption-text.js";
import { rangeThumbAppearance } from "../styles/range-thumb-appearance.js";
import { mergeStyle } from "../utils/merge-style.js";
import { resolveFillPercent } from "../utils/resolve-fill-percent.js";

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
	 * Value {@link Slider} shares through component context so every nested
	 * {@link Slider.Track}, {@link Slider.Thumb}, and {@link Slider.Output}
	 * reads the same resolved range, value, orientation, and thumb id.
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
	 * Every native `<input>` attribute except `type` and `role`, fixed to
	 * `"range"` and the platform's implicit `"slider"` role. `min`/`max`/`step`
	 * override the range inherited from the nearest ancestor {@link Slider}.
	 */
	export interface ThumbProps extends Omit<TagProps<"input">, "type" | "role"> {}

	/**
	 * Props accepted by {@link Slider.Output}.
	 */
	export interface OutputProps extends TagProps<"output"> {}
}

/**
 * Renders the root host: a `<div>` stacking its children, growing to fill
 * the inline axis by default or a fixed block axis when vertical. Resolves
 * the range, value, orientation, and thumb id into context for nested parts.
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
 * Renders the visual track: a `position: relative` `<div>` that draws a rail
 * and fill bar as pseudo-elements sized from context's resolved value, and
 * overlays a nested {@link Slider.Thumb} so native drag spans its full length.
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
		let resolvedStyle = mergeStyle(style, { "--ui-slider-fill": `${fillPercent}%` });

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
					before([absolute(), rounded("full"), bg("neutral.border"), pseudoContent('""')]),
					after([absolute(), rounded("full"), bg("brand.solid"), pseudoContent('""')]),
					when('[data-orientation="vertical"] &', [grow(), shrink(1), basis("0%")]),
					when('[data-orientation="horizontal"] &::before', [
						bs("var(--ui-slider-track-thickness, 0.5rem)"),
						insIs("0"),
						insIe("0"),
						insBs("50%"),
						translateY("-50%"),
					]),
					when('[data-orientation="horizontal"] &::after', [
						bs("var(--ui-slider-track-thickness, 0.5rem)"),
						is("var(--ui-slider-fill, 0%)"),
						insIs("0"),
						insBs("50%"),
						translateY("-50%"),
					]),
					when('[data-orientation="vertical"] &::before', [
						is("var(--ui-slider-track-thickness, 0.5rem)"),
						bs("100%"),
						insBs("0"),
						insIs("50%"),
						translateX("-50%"),
					]),
					when('[data-orientation="vertical"] &::after', [
						is("var(--ui-slider-track-thickness, 0.5rem)"),
						bs("var(--ui-slider-fill, 0%)"),
						insBe("0"),
						insIs("50%"),
						translateX("-50%"),
					]),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the interactive thumb: a native `<input type="range">` reset to
 * cover {@link Slider.Track}'s full box so native drag and keyboard control
 * span its whole length, rotating with `writing-mode` when vertical.
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
					bg("transparent"),
					cursor("pointer"),
					when("&:disabled", cursor("not-allowed")),
					outlineStyle("none"),
					when("&::-webkit-slider-runnable-track", [appearance(), bs("100%"), bg("transparent")]),
					when("&::-moz-range-track", [
						appearance(),
						bs("100%"),
						bg("transparent"),
						border({ style: "none" }),
					]),
					when(
						'[data-orientation="vertical"] &',
						raw({ writingMode: "vertical-lr", direction: "rtl" }),
					),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders a live readout: a native `<output>` associated by default with
 * the nearest ancestor {@link Slider}'s thumb via `htmlFor`, so assistive
 * technology knows which control it reports on. Pass the value as `children`.
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

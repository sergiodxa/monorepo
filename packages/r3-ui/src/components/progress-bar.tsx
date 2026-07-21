/**
 * A styled native `<progress>` control paired with an optional value label,
 * stacked in a single column so a caption can sit alongside the bar it
 * describes. The indicator's track and fill read entirely from the control's
 * own `value`/`max` attributes and its native `:indeterminate` state, so a
 * value-less indicator already renders as busy with zero library JavaScript.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/** Native `max` value {@link ProgressBar.Indicator} falls back to when `max` is omitted, matching the common percentage-based convention rather than the platform's own default of `1`. */
const DEFAULT_MAX = 100;

/**
 * Prop types for {@link ProgressBar} and its compound parts.
 */
export namespace ProgressBar {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * The root only supplies the column layout stacking
	 * {@link ProgressBar.Indicator} and {@link ProgressBar.ValueLabel}; it
	 * carries no semantics of its own.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<progress>` attribute, unchanged, plus the `mix`
	 * passthrough. `value` left unset renders the platform's own
	 * indeterminate state, matched by `:indeterminate` throughout this
	 * module's styling and by the animation layer's `shimmer()`/`pulse()`
	 * factories by default. `max` defaults to {@link DEFAULT_MAX} rather than
	 * the platform's own default of `1`, so a bare `value` reads as a
	 * percentage without also passing `max={100}` every time.
	 */
	export interface IndicatorProps extends TagProps<"progress"> {}

	/**
	 * Every native `<span>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ValueLabelProps extends TagProps<"span"> {}
}

/**
 * Renders the root column: a `<div>` stacking {@link ProgressBar.Indicator}
 * and an optional {@link ProgressBar.ValueLabel} with a small gap between
 * them. It carries no ARIA of its own — the native `<progress>` element
 * inside already exposes the platform's own progressbar semantics.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the root column's markup.
 * @example
 * <ProgressBar>
 * 	<ProgressBar.Indicator value={70} max={100} aria-label={t("upload.progress")} />
 * 	<ProgressBar.ValueLabel>{t("upload.percent", { value: 70 })}</ProgressBar.ValueLabel>
 * </ProgressBar>
 */
export function ProgressBar(handle: Handle<ProgressBar.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					css({
						display: "flex",
						flexDirection: "column",
						gap: "0.25rem",
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders the busy/progress indicator: a native `<progress>` stripped of its
 * platform chrome via `appearance: none` and redrawn as a pill-shaped track
 * filled in the semantic primary color, sized through `--ui-*` custom
 * properties with sensible fallbacks. The track color and shape are set on
 * the host itself (the element Firefox draws its track from directly) and
 * mirrored onto the `::-webkit-progress-bar` pseudo-element for Chromium and
 * Safari; the fill color and shape are set on both the
 * `::-webkit-progress-value` and `::-moz-progress-bar` pseudo-elements,
 * which is where each engine actually paints it.
 *
 * Leaving `value` unset drops the control into the platform's own
 * indeterminate state, matched here by `:indeterminate` and by the
 * `shimmer()`/`pulse()` factories from the animation layer by default. This
 * indicator's own styling holds still — compose one of those factories
 * through `mix` for the sweeping or breathing busy cue.
 *
 * @param handle Runtime handle carrying the host `<progress>`'s props.
 * @returns The render function producing the indicator's markup.
 * @example
 * <ProgressBar.Indicator value={70} max={100} aria-label={t("upload.progress")} />
 * @example
 * <ProgressBar.Indicator aria-label={t("upload.progress")} mix={[shimmer()]} />
 */
ProgressBar.Indicator = function ProgressBarIndicator(handle: Handle<ProgressBar.IndicatorProps>) {
	return () => {
		let { mix, max, ...rest } = handle.props;
		let resolvedMax = max ?? DEFAULT_MAX;

		warnIfNoAccessibleLabel(
			handle.props,
			"ProgressBar.Indicator: a progress indicator with no `aria-label` or `aria-labelledby` needs one describing what it tracks — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<progress
				max={resolvedMax}
				{...rest}
				mix={[
					css({
						WebkitAppearance: "none",
						MozAppearance: "none",
						appearance: "none",
						display: "block",
						inlineSize: "100%",
						blockSize: "var(--ui-progress-bar-block-size, 0.5rem)",
						border: "none",
						margin: "0",
						padding: "0",
						overflow: "hidden",
						borderRadius: "var(--ui-radius-full, 9999px)",
						backgroundColor: "var(--ui-neutral-border)",

						"&::-webkit-progress-bar": {
							backgroundColor: "var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-full, 9999px)",
						},

						"&::-webkit-progress-value": {
							backgroundColor: "var(--ui-primary-bg-solid)",
							borderRadius: "var(--ui-radius-full, 9999px)",
							transitionProperty: "all",
							transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
							transitionDuration: "150ms",
						},

						"&::-moz-progress-bar": {
							backgroundColor: "var(--ui-primary-bg-solid)",
							borderRadius: "var(--ui-radius-full, 9999px)",
							transitionProperty: "all",
							transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
							transitionDuration: "150ms",
						},

						"@media (prefers-reduced-motion: reduce)": {
							"&::-webkit-progress-value": { transitionDuration: "0s" },
							"&::-moz-progress-bar": { transitionDuration: "0s" },
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the indicator's caption: a `<span>` sized as a small run of body
 * copy in the neutral muted foreground color, for a percentage or status
 * string placed alongside {@link ProgressBar.Indicator}.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the value label's markup.
 * @example
 * <ProgressBar.ValueLabel>{t("upload.percent", { value: 70 })}</ProgressBar.ValueLabel>
 */
ProgressBar.ValueLabel = function ProgressBarValueLabel(
	handle: Handle<ProgressBar.ValueLabelProps>,
) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				mix={[
					css({
						fontSize: "0.875rem",
						lineHeight: "calc(1.25 / 0.875)",
						color: "var(--ui-neutral-fg)",
					}),
					mix,
				]}
			/>
		);
	};
};

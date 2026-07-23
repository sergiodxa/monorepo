/**
 * A styled native `<meter>` gauge paired with an optional value label,
 * stacked in a single column so a caption can sit alongside the bar it
 * measures. The gauge's track and fill read entirely from the control's own
 * `value`/`min`/`max` attributes, tinted by a semantic color role chosen
 * independently of the platform's own optimum/suboptimum quality coloring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { appearance, vstack } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { bs, is, m, p } from "@pkg/u/size";
import { css } from "remix/ui";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/** Semantic color role {@link Meter.Indicator} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Meter.Color = "neutral";

/**
 * Native `max` value {@link Meter.Indicator} falls back to when `max` is
 * omitted, matching the common percentage-based convention rather than the
 * platform's own default of `1`.
 */
const DEFAULT_MAX = 100;

/**
 * Selector list matching every engine's pseudo-element for a meter's filled
 * portion: WebKit/Blink split the fill in three depending on how `value`
 * compares to `low`/`high`/`optimum`, while Gecko exposes a single one. This
 * module colors all four identically from `data-color` so the fill's tone
 * always reflects the semantic role a consumer chose, never the platform's
 * own optimum/suboptimum quality judgment.
 */
const FILL_PSEUDO_ELEMENTS =
	"&::-webkit-meter-optimum-value, &::-webkit-meter-suboptimum-value, &::-webkit-meter-even-less-good-value, &::-moz-meter-bar";

/**
 * Prop types for {@link Meter} and its compound parts.
 */
export namespace Meter {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*-bg-solid`
	 * variable for the gauge's filled portion.
	 */
	export type Color = "primary" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * The root only supplies the column layout stacking {@link Indicator} and
	 * {@link ValueLabel}; it carries no semantics of its own.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<meter>` attribute — `value`, `min`, `max`, `low`, `high`,
	 * `optimum`, and `form` all work exactly as they would on a bare element —
	 * plus `color` and the `mix` passthrough. `max` defaults to
	 * {@link DEFAULT_MAX} rather than the platform's own default of `1`, so a
	 * bare `value` reads as a percentage without also passing `max={100}`
	 * every time.
	 */
	export interface IndicatorProps extends TagProps<"meter"> {
		/** Semantic color role for the gauge's fill. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	}

	/**
	 * Every native `<span>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ValueLabelProps extends TagProps<"span"> {}
}

/**
 * Renders the root column: a `<div>` stacking {@link Meter.Indicator} and an
 * optional {@link Meter.ValueLabel} with a small gap between them. It carries
 * no ARIA of its own — the native `<meter>` element inside already exposes
 * the platform's own meter semantics.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the root column's markup.
 * @example
 * <Meter>
 * 	<Meter.Indicator value={45} max={100} aria-label={t("storage.used")} />
 * 	<Meter.ValueLabel>{t("storage.percent", { value: 45 })}</Meter.ValueLabel>
 * </Meter>
 */
export function Meter(handle: Handle<Meter.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} mix={[vstack({ gap: "0.25rem" }), mix]} />;
	};
}

/**
 * Renders the gauge itself: a native `<meter>` stripped of its platform
 * chrome via `appearance: none` and redrawn as a pill-shaped track filled in
 * a semantic color, sized through `--ui-*` custom properties with sensible
 * fallbacks. The track color and shape are set on the host itself (the
 * element Firefox draws its track from directly) and mirrored onto the
 * `::-webkit-meter-bar` pseudo-element for Chromium and Safari; the fill
 * color and shape are set on `::-webkit-meter-optimum-value`,
 * `::-webkit-meter-suboptimum-value`, `::-webkit-meter-even-less-good-value`,
 * and `::-moz-meter-bar` alike, so `low`/`high`/`optimum` keep shaping the
 * gauge's accessible semantics without ever changing its rendered color —
 * that's `color`'s job instead.
 *
 * In dev mode, a gauge with no `aria-label` or `aria-labelledby` logs a
 * `console.warn`, since assistive technology otherwise has no accessible
 * name to announce for it.
 *
 * @param handle Runtime handle carrying the host `<meter>`'s props.
 * @returns The render function producing the gauge's markup.
 * @example
 * <Meter.Indicator value={45} max={100} aria-label={t("storage.used")} />
 * @example
 * <Meter.Indicator color="danger" value={92} aria-label={t("cpu.usage")} />
 * @example
 * <Meter.Indicator
 * 	color="success"
 * 	value={8}
 * 	low={3}
 * 	high={9}
 * 	optimum={10}
 * 	max={10}
 * 	aria-label={t("rating.score")}
 * />
 */
Meter.Indicator = function MeterIndicator(handle: Handle<Meter.IndicatorProps>) {
	return () => {
		let { color, max, mix, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedMax = max ?? DEFAULT_MAX;

		warnIfNoAccessibleLabel(
			handle.props,
			"Meter.Indicator: a meter with no `aria-label` or `aria-labelledby` needs one describing what it measures — assistive technology has no accessible name to announce otherwise.",
		);

		return (
			<meter
				data-color={resolvedColor}
				max={resolvedMax}
				{...rest}
				mix={[
					appearance(),
					is("full"),
					bs("var(--ui-meter-track-block-size, 0.5rem)"),
					m("0"),
					p("0"),
					overflow("hidden"),
					rounded("full"),
					bg("neutral.border"),
					css({
						display: "block",
						border: "none",

						"&::-webkit-meter-bar": {
							backgroundColor: "var(--ui-neutral-border)",
							borderRadius: "var(--ui-radius-full, 9999px)",
						},

						[FILL_PSEUDO_ELEMENTS]: {
							borderRadius: "var(--ui-radius-full, 9999px)",
							transitionProperty: "all",
							transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
							transitionDuration: "150ms",
						},

						'&[data-color="primary"]': {
							[FILL_PSEUDO_ELEMENTS]: { backgroundColor: "var(--ui-primary-bg-solid)" },
						},
						'&[data-color="neutral"]': {
							[FILL_PSEUDO_ELEMENTS]: { backgroundColor: "var(--ui-neutral-bg-solid)" },
						},
						'&[data-color="success"]': {
							[FILL_PSEUDO_ELEMENTS]: { backgroundColor: "var(--ui-success-bg-solid)" },
						},
						'&[data-color="warning"]': {
							[FILL_PSEUDO_ELEMENTS]: { backgroundColor: "var(--ui-warning-bg-solid)" },
						},
						'&[data-color="danger"]': {
							[FILL_PSEUDO_ELEMENTS]: { backgroundColor: "var(--ui-danger-bg-solid)" },
						},

						"@media (prefers-reduced-motion: reduce)": {
							[FILL_PSEUDO_ELEMENTS]: { transitionDuration: "0s" },
						},
					}),
					mix,
				]}
			/>
		);
	};
};

/**
 * Renders the gauge's caption: a `<span>` sized as a small run of body copy
 * in the neutral muted foreground color, for a percentage or status string
 * placed alongside {@link Meter.Indicator}.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the value label's markup.
 * @example
 * <Meter.ValueLabel>{t("storage.percent", { value: 45 })}</Meter.ValueLabel>
 */
Meter.ValueLabel = function MeterValueLabel(handle: Handle<Meter.ValueLabelProps>) {
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

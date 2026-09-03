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

import { bg, border, fg } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { appearance, block, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, p } from "@sdxc/u/size";
import { data, when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name.js";

/** Semantic color role {@link Meter.Indicator} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Meter.Color = "neutral";

/**
 * Native `max` value {@link Meter.Indicator} falls back to when `max` is
 * omitted, matching the common percentage-based convention for a bare `value`.
 */
const DEFAULT_MAX = 100;

/**
 * Selector list matching every engine's pseudo-element for a meter's fill:
 * WebKit/Blink split it in three depending on `value` vs. `low`/`high`/
 * `optimum`; Gecko exposes one. All four resolve their color from `data-color`.
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
	export type Color = "brand" | "neutral" | "success" | "warning" | "danger";

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * The root only supplies the column layout stacking {@link Indicator} and
	 * {@link ValueLabel}; it carries no semantics of its own.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<meter>` attribute, unchanged, plus `color` and the `mix`
	 * passthrough. `max` defaults to {@link DEFAULT_MAX}, so a bare `value`
	 * reads directly as a percentage.
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
 * optional {@link Meter.ValueLabel} with a small gap. The native `<meter>`
 * inside already exposes the platform's meter semantics.
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
 * Renders the gauge as a pill-shaped track filled in a semantic `color`,
 * mirrored across each engine's fill pseudo-elements so `low`/`high`/`optimum`
 * keep shaping accessible semantics independently of the rendered color; dev mode warns when no accessible name is set.
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
					block(),
					border("none"),
					when("&::-webkit-meter-bar", [bg("neutral.border"), rounded("full")]),
					when(FILL_PSEUDO_ELEMENTS, [rounded("full"), transition("all")]),
					data("color", "brand", when(FILL_PSEUDO_ELEMENTS, bg("brand.solid"))),
					data("color", "neutral", when(FILL_PSEUDO_ELEMENTS, bg("neutral.solid"))),
					data("color", "success", when(FILL_PSEUDO_ELEMENTS, bg("success.solid"))),
					data("color", "warning", when(FILL_PSEUDO_ELEMENTS, bg("warning.solid"))),
					data("color", "danger", when(FILL_PSEUDO_ELEMENTS, bg("danger.solid"))),
					media(
						"(prefers-reduced-motion: reduce)",
						when(FILL_PSEUDO_ELEMENTS, raw({ transitionDuration: "0s" })),
					),
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

		return <span {...rest} mix={[text("sm"), fg("neutral"), mix]} />;
	};
};

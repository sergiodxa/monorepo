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

import { bg, border, fg } from "@pkg/u/color";
import { rounded, transition, transitionDuration } from "@pkg/u/effects";
import { appearance, block, flex, flexCol, gap } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, is, m, p } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { text } from "@pkg/u/typography";

import { warnIfNoAccessibleLabel } from "../utils/warn-if-no-accessible-name";

/** Native `max` value {@link ProgressBar.Indicator} falls back to when `max` is omitted, so a bare `value` reads as a percentage without passing `max={100}` every time. */
const DEFAULT_MAX = 100;

/**
 * Prop types for {@link ProgressBar} and its compound parts.
 */
export namespace ProgressBar {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * The root only supplies the column layout stacking {@link
	 * ProgressBar.Indicator} and {@link ProgressBar.ValueLabel}.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<progress>` attribute, unchanged, plus the `mix`
	 * passthrough. Leaving `value` unset renders the indeterminate state;
	 * `max` defaults to {@link DEFAULT_MAX}.
	 */
	export interface IndicatorProps extends TagProps<"progress"> {}

	/**
	 * Every native `<span>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface ValueLabelProps extends TagProps<"span"> {}
}

/**
 * Renders the root column: a `<div>` stacking {@link ProgressBar.Indicator}
 * and an optional {@link ProgressBar.ValueLabel}, carrying no ARIA of its
 * own since the `<progress>` inside already exposes progressbar semantics.
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

		return <div {...rest} mix={[flex(), flexCol(), gap("0.25rem"), mix]} />;
	};
}

/**
 * Renders the busy/progress indicator: a native `<progress>` restyled as a
 * pill track. Firefox paints from the host itself, so track and fill colors
 * mirror onto the `::-webkit-*`/`::-moz-*` pseudo-elements each engine paints.
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
					appearance(),
					block(),
					is("full"),
					bs("var(--ui-progress-bar-block-size, 0.5rem)"),
					m("0"),
					p("0"),
					overflow("hidden"),
					rounded("full"),
					bg("neutral.border"),
					when("&::-webkit-progress-bar", [bg("neutral.border"), rounded("full")]),
					when("&::-webkit-progress-value", [
						bg("brand.solid"),
						rounded("full"),
						transition("all"),
					]),
					when("&::-moz-progress-bar", [bg("brand.solid"), rounded("full"), transition("all")]),
					border("none"),
					media("(prefers-reduced-motion: reduce)", [
						when("&::-webkit-progress-value", transitionDuration("0s")),
						when("&::-moz-progress-bar", transitionDuration("0s")),
					]),
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

		return <span {...rest} mix={[fg("neutral"), text("sm"), mix]} />;
	};
};

/**
 * A busy indicator rendered as a rotating icon inside a `role="progressbar"`
 * host, colored by a semantic color role and sized by a size variant. Its own
 * styling holds still — compose the `spin()` factory from the animation
 * layer through `mix` for the rotating loop, so a page can render the
 * indicator's shape before any motion-driving CSS lands.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { LoaderCircleIcon } from "@pkg/icons";
import { bs, fg, inlineFlex, is, items, justify, when } from "@pkg/u";

import type { SemanticColor } from "../utils/semantic-color";

/** Semantic color role {@link Spinner} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Spinner.Color = "neutral";

/** Size variant {@link Spinner} falls back to when `size` is omitted. */
const DEFAULT_SIZE: Spinner.Size = "md";

/**
 * Prop types for {@link Spinner}.
 */
export namespace Spinner {
	/**
	 * Semantic color role, each mapped to its matching `--ui-*-fg` variable.
	 */
	export type Color = SemanticColor;

	/**
	 * Size variant controlling the rotating icon's rendered dimensions.
	 */
	export type Size = "sm" | "md" | "lg";

	/**
	 * Props accepted by {@link Spinner}.
	 */
	export interface Props extends Omit<TagProps<"div">, "aria-label"> {
		/** Semantic color role. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
		/** Size variant. Defaults to {@link DEFAULT_SIZE}. */
		size?: Size;
		/**
		 * Accessible label announced by assistive technology for as long as
		 * the spinner is on screen. Required — the component ships no
		 * built-in copy, so a consumer's own localized string drives it.
		 */
		"aria-label": string;
	}
}

/**
 * Renders a busy indicator: a `role="progressbar"` host with no
 * `aria-valuenow`, so assistive technology reads it as indeterminate. Pair
 * it with the `spin()` mixin from the animation layer for the rotating loop.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the indicator's markup.
 * @example
 * <Spinner aria-label={t("status.loading")} />
 * @example
 * <Spinner color="danger" size="lg" aria-label={t("status.retrying")} />
 * @example
 * <Spinner mix={[spin()]} aria-label={t("status.loading")} />
 */
export function Spinner(handle: Handle<Spinner.Props>) {
	return () => {
		let { mix, color, size, "aria-label": ariaLabel, ...rest } = handle.props;
		let resolvedColor = color ?? DEFAULT_COLOR;
		let resolvedSize = size ?? DEFAULT_SIZE;

		return (
			<div
				role="progressbar"
				aria-label={ariaLabel}
				data-color={resolvedColor}
				data-size={resolvedSize}
				{...rest}
				mix={[
					inlineFlex(),
					items("center"),
					justify("center"),

					when('&[data-color="brand"]', fg("brand")),
					when('&[data-color="neutral"]', fg("neutral")),
					when('&[data-color="success"]', fg("success")),
					when('&[data-color="warning"]', fg("warning")),
					when('&[data-color="danger"]', fg("danger")),

					when("& svg", [
						is("var(--ui-spinner-icon-size-md, 1.25rem)"),
						bs("var(--ui-spinner-icon-size-md, 1.25rem)"),
					]),
					when('&[data-size="sm"] svg', [
						is("var(--ui-spinner-icon-size-sm, 1rem)"),
						bs("var(--ui-spinner-icon-size-sm, 1rem)"),
					]),
					when('&[data-size="lg"] svg', [
						is("var(--ui-spinner-icon-size-lg, 1.75rem)"),
						bs("var(--ui-spinner-icon-size-lg, 1.75rem)"),
					]),
					mix,
				]}
			>
				<LoaderCircleIcon />
			</div>
		);
	};
}

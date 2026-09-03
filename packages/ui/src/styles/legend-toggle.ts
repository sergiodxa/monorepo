/**
 * Position-keyed visibility rules pairing a chart root with a later
 * legend: hides each `[data-color]` slot once the legend's same-position
 * `<label>` holds no checked input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { combine } from "@sdxc/u/general";
import { hidden } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";

import type { CSSStyles } from "../utils/css-styles";

import { CHART_COLOR_SLOT_COUNT } from "./chart-palette";

/**
 * Composes the categorical legend-toggle visibility rules as a `css()`
 * mixin covering every {@link CHART_COLOR_SLOT_COUNT} color slot. The
 * general sibling combinator requires the legend to follow the chart root.
 *
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <svg
 * 	mix={[
 * 		legendToggle(),
 * 		css({ display: "block", inlineSize: "100%", blockSize: "auto" }),
 * 	]}
 * >
 * 	{content}
 * </svg>;
 */
export function legendToggle<Node extends Element = Element>(): MixinDescriptor<
	Node,
	[styles: CSSStyles],
	ElementProps
> {
	let slots = Array.from({ length: CHART_COLOR_SLOT_COUNT }, (_, index) => index + 1);

	return combine<Node>(
		slots.map((slot) =>
			when<Node>(
				`&:has(~ [data-slot='legend'] label:nth-of-type(${slot}):not(:has(input:checked))) [data-color='${slot}']`,
				hidden(),
			),
		),
	);
}

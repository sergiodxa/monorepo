/**
 * The static, position-keyed visibility rules pairing a chart root with a
 * later-sibling legend: for each of the eight `--ui-chart-*` categorical
 * slots, hides every matching `[data-color]` descendant once the legend's
 * `n`-th `<label>` — matched purely by its position among its own siblings,
 * rather than any attribute on the checkbox itself — holds no checked
 * input. {@link legendToggle} composes this block as its own `css()` mixin,
 * ready to sit in a chart root's `mix` array alongside a separate `css()`
 * call for whatever display, sizing, and palette-painting declarations are
 * genuinely local to that root.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { combine } from "@pkg/u/general";
import { hidden } from "@pkg/u/layout";
import { when } from "@pkg/u/state";

import type { CSSStyles } from "../utils/css-styles";

import { CHART_COLOR_SLOT_COUNT } from "./chart-palette";

/**
 * Composes the categorical legend-toggle visibility rules as its own
 * `css()` mixin: one rule per {@link CHART_COLOR_SLOT_COUNT} categorical
 * color slot, each hiding every `[data-color]` descendant sharing that slot
 * once a later-sibling legend's matching checkbox item holds no checked
 * input. Every chart root pairing with a legend this way needs this
 * identical block, since the legend is read through the general sibling
 * combinator, which only matches siblings that follow the chart root in
 * source order.
 *
 * Compose the call directly in a chart root's `mix` array, alongside a
 * separate `css()` call for whatever display, sizing, and palette-painting
 * declarations are genuinely local to that root — this block only ever
 * declares `display: none`, so the two never contend over the same
 * property.
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

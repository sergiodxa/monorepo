/**
 * The eight-slot categorical color contract shared by every chart's plotted
 * elements, addressed everywhere through a `data-color` attribute.
 * {@link CHART_COLOR_SLOT_COUNT} sets how many `--ui-chart-*` slots a series
 * cycles through, and {@link chartPalette} generates one CSS rule per slot
 * since a selector can't be parameterized by a loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { combine, raw, var as varUtility } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Number of categorical color slots a chart's `--ui-chart-*` palette spans.
 * A series, wedge, or bar whose position in its own list outgrows this
 * count wraps back around to the first slot.
 */
export const CHART_COLOR_SLOT_COUNT = 8;

/**
 * Composes the mixin painting `property` from whichever of the
 * {@link CHART_COLOR_SLOT_COUNT} categorical slots an element's own
 * `data-color` attribute names, one rule generated per slot.
 *
 * @param property The CSS property each rule sets, read from the matching `--ui-chart-*` variable.
 * @param combinator Selector combinator placed between the mixin's own host and its `[data-color]` match. Defaults to `""`, matching the host itself.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <span data-color={String(color)} mix={[chartPalette("color"), css({ display: "inline-block" })]} />;
 * @example
 * // A chart root painting every nested `[data-color]` descendant from one
 * // shared mixin.
 * <svg mix={[chartPalette("fill", " "), css({ display: "block" })]}>{children}</svg>;
 */
export function chartPalette<Node extends Element = Element>(
	property: "color" | "fill" | "backgroundColor",
	combinator = "",
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let slots = Array.from({ length: CHART_COLOR_SLOT_COUNT }, (_, index) => index + 1);

	return combine<Node>(
		slots.map((slot) =>
			when<Node>(
				`&${combinator}[data-color="${slot}"]`,
				raw({ [property]: varUtility(`ui-chart-${slot}`) }),
			),
		),
	);
}

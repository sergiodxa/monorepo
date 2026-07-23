/**
 * The eight-slot categorical color contract shared by every chart's plotted
 * elements: a fixed `--ui-chart-1` through `--ui-chart-8` palette, addressed
 * everywhere through a `data-color` attribute rather than a hardcoded value
 * or a fixed semantic role. {@link CHART_COLOR_SLOT_COUNT} is how many slots
 * the palette spans — also how many colors a chart cycles back through once
 * its series, wedges, or bars outgrow the palette — and {@link chartPalette}
 * composes the mixin painting one property from whichever slot an element's
 * own `data-color` names, repeating its rule once per slot since neither a
 * CSS selector nor a custom property name can be parameterized by a loop of
 * its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { combine, raw } from "@pkg/u/general";
import { when } from "@pkg/u/state";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Number of categorical color slots a chart's `--ui-chart-*` palette spans.
 * A series, wedge, or bar whose position in its own list outgrows this count
 * wraps back around to the first slot instead of running out of colors.
 */
export const CHART_COLOR_SLOT_COUNT = 8;

/**
 * Composes the mixin painting `property` from whichever of the
 * {@link CHART_COLOR_SLOT_COUNT} categorical slots an element's own
 * `data-color` attribute names, one rule per slot across `--ui-chart-1`
 * through `--ui-chart-8`. `combinator` places the `[data-color]` match
 * relative to the mixin's own host — leave it at its default of `""` to
 * match the host element itself (a plotted group or swatch carrying
 * `data-color` directly), or pass a single space to match a descendant
 * instead (a chart root painting every one of its own nested `[data-color]`
 * elements from one shared mixin).
 *
 * @param property The CSS property each rule sets, read from the matching `--ui-chart-*` variable.
 * @param combinator Selector combinator placed between the mixin's own host and its `[data-color]` match. Defaults to `""`, matching the host itself.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <span data-color={String(color)} mix={[chartPalette("color"), css({ display: "inline-block" })]} />;
 * @example
 * // A chart root painting every nested `[data-color]` descendant from one
 * // shared mixin, rather than the host element itself.
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
				raw({ [property]: `var(--ui-chart-${slot})` }),
			),
		),
	);
}

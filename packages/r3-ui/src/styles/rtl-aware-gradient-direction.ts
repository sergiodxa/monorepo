/**
 * The custom-property declarations behind a linear-gradient direction that a
 * rangeable gradient track shares with its own `&:dir(rtl)` mirror: the
 * property lands at `"right"` by default and flips to `"left"` once the
 * surrounding writing direction reads right-to-left, so the same gradient
 * string paints correctly in either direction with no second, mirrored
 * gradient of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { combine, raw } from "@pkg/u/general";
import { when } from "@pkg/u/state";

import type { CSSStyles } from "../utils/css-styles";

/**
 * Composes the custom property pairing a gradient direction's `"right"`
 * default with its `"left"` mirror under `&:dir(rtl)`, as its own `css()`
 * mixin ready to compose in a host's `mix` array alongside whatever `css()`
 * call carries that host's own remaining, genuinely local declarations. A
 * gradient string built as `linear-gradient(to var(propertyName, right), ...)`
 * reads the same property for its own direction, so the painted gradient
 * always agrees with the flip this mixin declares.
 *
 * @param propertyName The custom property the gradient direction reads from.
 * @returns A `css()` mixin ready for a host element's `mix` prop.
 * @example
 * <div
 * 	mix={[
 * 		rtlAwareGradientDirection("--ui-color-slider-track-direction"),
 * 		css({ ...ownStyles }),
 * 	]}
 * />;
 */
export function rtlAwareGradientDirection<Node extends Element = Element>(
	propertyName: string,
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	return combine<Node>([
		raw({ [propertyName]: "right" }),
		when<Node>("&:dir(rtl)", raw({ [propertyName]: "left" })),
	]);
}

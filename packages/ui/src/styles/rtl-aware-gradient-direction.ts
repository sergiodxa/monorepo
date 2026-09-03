/**
 * The custom-property declarations behind a linear-gradient direction that a
 * rangeable gradient track shares with its own `&:dir(rtl)` mirror: the
 * property lands at `"right"` by default and flips to `"left"` once the
 * surrounding writing direction reads right-to-left, so the same gradient
 * string paints correctly in either direction from one shared declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ElementProps, MixinDescriptor } from "remix/ui";

import { combine, vars } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

import type { CSSStyles } from "../utils/css-styles.js";

/** Strips a leading `--` from a custom property name, matching `u.vars()`'s own bare-name convention. */
function stripLeadingDashes(propertyName: string): string {
	return propertyName.replace(/^--/, "");
}

/**
 * Composes the custom property pairing a gradient direction's `"right"`
 * default with its `"left"` mirror under `&:dir(rtl)`, ready to compose
 * alongside a host's own remaining, genuinely local declarations.
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
	let name = stripLeadingDashes(propertyName);
	return combine<Node>([
		vars<Node>({ [name]: "right" }),
		when<Node>("&:dir(rtl)", vars<Node>({ [name]: "left" })),
	]);
}

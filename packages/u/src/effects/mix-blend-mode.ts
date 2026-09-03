/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/** Every blend mode `mix-blend-mode` accepts, including the two `plus-*` compositing modes. */
export type MixBlendModeValue =
	| "normal"
	| "multiply"
	| "screen"
	| "overlay"
	| "darken"
	| "lighten"
	| "color-dodge"
	| "color-burn"
	| "hard-light"
	| "soft-light"
	| "difference"
	| "exclusion"
	| "hue"
	| "saturation"
	| "color"
	| "luminosity"
	| "plus-darker"
	| "plus-lighter";

/**
 * Blends the element with the content painted behind it. Any value but
 * `normal` makes the element its own stacking context, and blending stops at
 * the nearest one — put `u.isolate()` on the ancestor that should bound it.
 *
 * @example u.mixBlendMode()
 * @example css({ mixBlendMode: "multiply" })
 * @example u.mixBlendMode("plus-lighter")
 * @example css({ mixBlendMode: "plus-lighter" })
 */
export function mixBlendMode<Node extends Element = Element>(
	value: MixBlendModeValue = "multiply",
) {
	return utility<Node>(() => ({ mixBlendMode: value }));
}

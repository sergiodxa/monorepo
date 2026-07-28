/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

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
 * Applies `mix-blend-mode`, blending the element with the content painted
 * behind it instead of simply covering it — a `multiply` caption that darkens
 * into its background, a `plus-lighter` glow, a `luminosity` treatment that
 * keeps a backdrop's hue but takes the overlay's lightness.
 *
 * Three things worth knowing before reaching for it:
 *
 * - Any value other than `normal` makes the element create a stacking context
 *   of its own, so its `z-index` starts being interpreted and its descendants
 *   can no longer be layered against elements outside it.
 * - Blending is confined to the nearest stacking context. That means the
 *   element blends with its siblings and ancestors' painting up to that
 *   boundary, and no further — which is exactly how the effect gets contained:
 *   put `u.isolate()` on the ancestor that should be the outer limit and the
 *   blend stops there instead of reaching the page background.
 * - It blends against *whatever* happens to be painted behind it. Over a fixed
 *   design that is predictable; over user-supplied imagery it is not, since a
 *   mode that reads well on a dark photo can make the same text vanish on a
 *   light one. Text over uncontrolled images wants an opaque or scrim
 *   treatment, not a blend mode.
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

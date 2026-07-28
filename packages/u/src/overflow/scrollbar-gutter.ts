/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * How much room a scroll container sets aside for its scrollbar before one
 * ever appears. `"auto"` reserves nothing, so the scrollbar's appearance
 * shifts the content beside it; `"stable"` reserves the gutter up front on the
 * inline-end side whether or not a scrollbar is showing; `"stable both-edges"`
 * reserves it symmetrically on both sides, so centred content stays centred
 * once the scrollbar arrives.
 */
export type ScrollbarGutterValue = "auto" | "stable" | "stable both-edges";

/**
 * Applies `scrollbar-gutter`, defaulting to `"stable"`. It solves a concrete
 * jump: without a reserved gutter, the moment a list grows past its container
 * the scrollbar appears and every line of content reflows sideways by the
 * scrollbar's width — a visible lurch on every load-more, filter, or async
 * render. Reserving the gutter up front means the layout is already the size
 * it will settle at.
 *
 * `u.thinScrollbar()` already sets `scrollbar-gutter: stable` as part of its
 * recipe, so this is the general primitive sitting behind it, and the two
 * conflict when applied to the same element. Prefer the recipe unless you
 * specifically want `"stable both-edges"` for symmetry or `"auto"` to opt back
 * out. The property only applies to a scroll container, so it needs
 * `u.scroll()` or `u.overflow()` on the same element to do anything.
 *
 * @example u.scrollbarGutter()
 * @example css({ scrollbarGutter: "stable" })
 * @example u.scrollbarGutter("stable both-edges")
 * @example css({ scrollbarGutter: "stable both-edges" })
 * @example u.scrollbarGutter("auto")
 * @example css({ scrollbarGutter: "auto" })
 */
export function scrollbarGutter<Node extends Element = Element>(
	value: ScrollbarGutterValue = "stable",
) {
	return utility<Node>(() => ({ scrollbarGutter: value }));
}

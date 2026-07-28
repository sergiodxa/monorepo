/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * The axis a scroll container snaps along. Prefer the logical `"inline"` and
 * `"block"` — they follow the writing mode, so a carousel stays correct under
 * RTL and vertical writing modes. `"x"` and `"y"` are the physical exception,
 * for the rare case that must stay pinned to the screen axis no matter the
 * writing mode.
 */
export type ScrollSnapAxis = "inline" | "block" | "both" | "x" | "y";

/**
 * How firmly the container snaps: `"mandatory"` always rests on a snap
 * position, `"proximity"` only snaps when a scroll ends near one.
 */
export type ScrollSnapStrictness = "mandatory" | "proximity";

/**
 * Applies `scroll-snap-type` to a scroll container, defaulting to
 * `"inline mandatory"` — the paged-carousel case. Pass `"none"` as the axis to
 * disable snapping entirely, which emits the bare `scroll-snap-type: none`
 * with no strictness segment. This goes on the scroll container itself; the
 * children it snaps to need `u.scrollSnapAlign()`.
 *
 * @example u.scrollSnapType()
 * @example css({ scrollSnapType: "inline mandatory" })
 * @example u.scrollSnapType("block", "proximity")
 * @example css({ scrollSnapType: "block proximity" })
 * @example u.scrollSnapType("none")
 * @example css({ scrollSnapType: "none" })
 */
export function scrollSnapType<Node extends Element = Element>(
	axis: ScrollSnapAxis | "none" = "inline",
	strictness: ScrollSnapStrictness = "mandatory",
) {
	if (axis === "none") return utility<Node>(() => ({ scrollSnapType: "none" }));
	return utility<Node>(() => ({ scrollSnapType: `${axis} ${strictness}` }));
}

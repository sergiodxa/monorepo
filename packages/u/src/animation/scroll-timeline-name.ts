/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `scroll-timeline-name` property, naming a scroll progress
 * timeline driven by how far the host element has been scrolled. It goes on the
 * *scroll container* itself — the element that actually overflows and scrolls,
 * so it needs an `overflow` value that scrolls (see `u.overflow()`) or it
 * provides no progress at all. The timeline runs 0% at the scroll start
 * position to 100% at the end.
 *
 * This is the *declaring* half of a named timeline, the counterpart of the
 * declaring/referencing split `u.anchorName()` and `u.positionAnchor()` solve
 * for anchor positioning. `u.animation()`'s `timeline` option already accepts
 * the *anonymous* `"scroll()"`, which walks up to the animating element's own
 * nearest scrolling ancestor. Declare a name here when the animating element
 * lives outside that container — a progress bar in a header, a marker in a
 * sidebar — so it can point at a specific scroller instead of whichever one
 * happens to be above it.
 *
 * The *referencing* half is `u.animation({ timeline: "--{name}" })` — an
 * `animation-timeline` name is a bare dashed-ident, so the reference is the
 * literal `--`-prefixed name and **not** a `var()` call. `u.var("page-scroll")`
 * would emit `var(--page-scroll)`, which substitutes the *value* of a custom
 * property rather than naming a timeline.
 *
 * The leading `--` is omitted from `name`, mirroring the convention
 * `u.vars()` and `u.var()` already use for custom properties, since a timeline
 * name is a dashed-ident just like a custom property.
 *
 * A scroll-driven animation wants `duration: "auto"` so its progress comes
 * from the timeline instead of the clock. The name is only visible to the
 * declaring element's descendants and later siblings — for an animation
 * anywhere else in the tree, raise it with {@link timelineScope} on a common
 * ancestor.
 *
 * @example u.scrollTimelineName("page-scroll")
 * @example css({ scrollTimelineName: "--page-scroll" })
 * @example u.scrollTimelineName("log-scroll")
 * @example css({ scrollTimelineName: "--log-scroll" })
 */
export function scrollTimelineName<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ scrollTimelineName: `--${name}` }));
}

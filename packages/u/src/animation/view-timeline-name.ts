/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `view-timeline-name` property, naming a view progress timeline
 * driven by the host element's own visibility within its scrollport. It goes
 * on the element being *watched* — the card, the section, the image — not on
 * the scroll container and not on the element that animates.
 *
 * This is the *declaring* half of a named timeline, and it exists for the same
 * reason `u.anchorName()` does: one element declares a name, another
 * references it, and the referencing side alone can't work. `u.animation()`'s
 * `timeline` option already accepts an *anonymous* timeline such as `"view()"`,
 * which only ever reads the animating element's own visibility. Declare a name
 * here when the element that animates is not the element whose visibility
 * should drive it.
 *
 * The *referencing* half is `u.animation({ timeline: "--{name}" })` — an
 * `animation-timeline` name is a bare dashed-ident, so the reference is the
 * literal `--`-prefixed name and **not** a `var()` call. `u.var("reveal")`
 * would emit `var(--reveal)`, which substitutes the *value* of a custom
 * property instead of naming a timeline, and the animation would fall back to
 * the document timeline.
 *
 * The leading `--` is omitted from `name`, mirroring the convention
 * `u.vars()` and `u.var()` already use for custom properties, since a timeline
 * name is a dashed-ident just like a custom property.
 *
 * Pair it with `u.animation()`'s `range` option (e.g. `"entry 0% cover 40%"`)
 * to pick which slice of the element's pass through the scrollport maps onto
 * the animation, and remember a scroll-driven animation wants
 * `duration: "auto"` so its progress comes from the timeline rather than the
 * clock. The name is only visible to the declaring element's descendants and
 * later siblings — for anything outside that subtree, raise it with
 * {@link timelineScope} on a common ancestor.
 *
 * @example u.viewTimelineName("reveal")
 * @example css({ viewTimelineName: "--reveal" })
 * @example u.viewTimelineName("hero-image")
 * @example css({ viewTimelineName: "--hero-image" })
 */
export function viewTimelineName<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ viewTimelineName: `--${name}` }));
}

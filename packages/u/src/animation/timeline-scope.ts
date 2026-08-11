/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies the `timeline-scope` property, widening where one or more named
 * timelines can be seen. This is the piece scroll-driven animations get stuck
 * on: a timeline name declared by {@link scrollTimelineName} or
 * {@link viewTimelineName} is only visible to the declaring element's own
 * descendants and its later siblings, so an animation on an element *outside*
 * that subtree — an earlier sibling, an ancestor, a cousin — resolves the name
 * to nothing and silently falls back to the document timeline. Naming the
 * timeline on a common ancestor with this utility raises its visibility to that
 * ancestor's whole subtree, so both the declaring element and the animating one
 * are inside it.
 *
 * The classic case is a reading-progress bar in a page header driven by a
 * scroller that comes later in the document: the header is an *earlier*
 * sibling, so it can't see the scroller's name on its own. Put
 * `u.timelineScope("page-scroll")` on the element wrapping both, and the bar's
 * `u.animation({ timeline: "--page-scroll", duration: "auto" })` resolves.
 *
 * It declares scope only — it does not create a timeline. Something inside the
 * subtree still has to declare the actual name, and if nothing does, the name
 * resolves to an inactive timeline (the animation holds at its start rather
 * than running).
 *
 * The leading `--` is omitted from each name, mirroring the convention
 * `u.vars()` and `u.var()` already use for custom properties, and matching the
 * declaring utilities on the other side.
 *
 * Called with no names it emits `none`, the property's initial value — an
 * empty value would serialize to the invalid `timeline-scope: ;`, which
 * browsers drop while still counting as a declaration in the emitted CSS.
 *
 * @example u.timelineScope("page-scroll")
 * @example css({ timelineScope: "--page-scroll" })
 * @example u.timelineScope("page-scroll", "hero-reveal")
 * @example css({ timelineScope: "--page-scroll, --hero-reveal" })
 */
export function timelineScope<Node extends Element = Element>(...names: string[]) {
	return utility<Node>(() => ({
		timelineScope: names.length === 0 ? "none" : names.map((name) => `--${name}`).join(", "),
	}));
}

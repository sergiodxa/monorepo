/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Applies the `timeline-scope` property, raising a named timeline's
 * visibility to a common ancestor's subtree so animations outside the
 * declaring element can resolve the name; the subtree still declares it.
 *
 * @default `none`, the property's initial value, emitted when no names
 * are given so the declaration stays valid.
 * @see {@link scrollTimelineName}
 * @see {@link viewTimelineName}
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

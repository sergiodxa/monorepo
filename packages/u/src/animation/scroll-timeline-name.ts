/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `scroll-timeline-name` to the scroll container itself, which needs
 * an `overflow` value that scrolls. The leading `--` is added here, and the
 * animation references the literal dashed-ident: `timeline: "--{name}"`.
 *
 * @see {@link timelineScope} to raise the name past the declaring element's
 * descendants and later siblings.
 * @example u.scrollTimelineName("page-scroll")
 * @example css({ scrollTimelineName: "--page-scroll" })
 * @example u.scrollTimelineName("log-scroll")
 * @example css({ scrollTimelineName: "--log-scroll" })
 */
export function scrollTimelineName<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ scrollTimelineName: `--${name}` }));
}

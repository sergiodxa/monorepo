/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Applies `view-timeline-name` to the element being *watched* — the card, the
 * section, the image. The leading `--` is added here, and the animation
 * references the literal dashed-ident: `timeline: "--{name}"`.
 *
 * @see {@link timelineScope} to raise the name past the declaring element's
 * descendants and later siblings.
 * @example u.viewTimelineName("reveal")
 * @example css({ viewTimelineName: "--reveal" })
 * @example u.viewTimelineName("hero-image")
 * @example css({ viewTimelineName: "--hero-image" })
 */
export function viewTimelineName<Node extends Element = Element>(name: string) {
	return utility<Node>(() => ({ viewTimelineName: `--${name}` }));
}

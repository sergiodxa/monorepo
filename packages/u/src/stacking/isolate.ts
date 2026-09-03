/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Creates a new stacking context on the host element while preserving its
 * layout, so a later `z-index` on this element (or a descendant) stays
 * confined here, isolated from unrelated siblings outside it.
 *
 * @example u.isolate()
 * @example css({ isolation: "isolate" })
 */
export function isolate<Node extends Element = Element>() {
	return utility<Node>(() => ({ isolation: "isolate" }));
}

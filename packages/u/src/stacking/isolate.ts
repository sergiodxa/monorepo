/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Creates a new stacking context on the host element without otherwise
 * changing its layout, so a later `z-index` on this element (or on a
 * descendant) can't be interleaved with unrelated siblings outside it.
 *
 * @example u.isolate()
 * @example css({ isolation: "isolate" })
 */
export function isolate<Node extends Element = Element>() {
	return utility<Node>(() => ({ isolation: "isolate" }));
}

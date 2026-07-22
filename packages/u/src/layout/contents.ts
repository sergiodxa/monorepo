/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor";

/**
 * Sets `display: contents`, removing the host element's own box so its
 * children lay out as if the host weren't there.
 *
 * @example u.contents()
 * @example css({ display: "contents" })
 */
export function contents<Node extends Element = Element>() {
	return utility<Node>(() => ({ display: "contents" }));
}

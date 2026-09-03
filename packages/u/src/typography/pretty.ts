/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Avoids leaving a short orphan word alone on the last line of a wrapped
 * block, scaling to long-form body copy since browsers don't cap how many
 * lines it applies to.
 *
 * @example u.pretty()
 * @example css({ textWrap: "pretty" })
 */
export function pretty<Node extends Element = Element>() {
	return utility<Node>(() => ({ textWrap: "pretty" }));
}

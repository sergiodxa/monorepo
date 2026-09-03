/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { utility } from "../internal/descriptor.js";

/**
 * Sets the host element's `z-index` from a plain number. Named component
 * layers such as `"toast"` or `"modal"` are an app or component concern,
 * so this primitive stays scoped to raw numeric values.
 *
 * @example u.z(10)
 * @example css({ zIndex: 10 })
 */
export function z<Node extends Element = Element>(value: number) {
	return utility<Node>(() => ({ zIndex: value }));
}
